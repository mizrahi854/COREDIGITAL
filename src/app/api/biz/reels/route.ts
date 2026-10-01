import { prisma } from "@/lib/db";
import { CATEGORY_IDS } from "@/lib/constants";
import { badRequest } from "@/lib/errors";
import { api, limit } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";
import { saveReelOriginal, validateVideoUpload } from "@/server/media";
import { enqueue } from "@/server/jobs";
import type { Category } from "@prisma/client";

/**
 * Upload flow: validate → store original → reel PROCESSING → worker transcodes.
 * The reel becomes PUBLISHED only after processing succeeds (and if the owner chose to publish).
 */
export const POST = api(async (req) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  await limit(req, "reel-upload", 20, 3600, access.userId);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("לא נבחר סרטון");
  await validateVideoUpload(file);
  if (form.get("rightsConfirmed") !== "true") {
    throw badRequest("יש לאשר שיש לך זכויות שימוש בסרטון ושהמצולמים נתנו הסכמה");
  }
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300);
  const tags = String(form.get("tags") ?? "")
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
  const category = String(form.get("category") ?? "");
  if (!CATEGORY_IDS.includes(category as Category)) throw badRequest("בחרו קטגוריה");
  const serviceId = String(form.get("serviceId") ?? "") || null;
  const staffId = String(form.get("staffId") ?? "") || null;
  if (serviceId && !(await prisma.service.count({ where: { id: serviceId, businessId: access.businessId } })))
    throw badRequest("השירות לא שייך לעסק");
  if (staffId && !(await prisma.staffMember.count({ where: { id: staffId, businessId: access.businessId } })))
    throw badRequest("איש הצוות לא שייך לעסק");

  const reel = await prisma.reel.create({
    data: {
      businessId: access.businessId,
      caption,
      tags,
      category: category as Category,
      serviceId,
      staffId,
      status: "DRAFT",
      rightsConfirmed: true,
      publishWhenReady: form.get("publish") === "true",
    },
  });
  try {
    const originalPath = await saveReelOriginal(file, reel.id);
    await prisma.$transaction(async (tx) => {
      await tx.reel.update({ where: { id: reel.id }, data: { originalPath, status: "PROCESSING" } });
      await enqueue("process_reel", { reelId: reel.id }, tx);
    });
  } catch (e) {
    await prisma.reel.update({
      where: { id: reel.id },
      data: { status: "FAILED", failureReason: e instanceof Error ? e.message : "ההעלאה נכשלה" },
    });
    throw e;
  }
  return { id: reel.id, status: "PROCESSING" };
});
