import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { api, limit } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";
import { saveImage } from "@/server/media";

/** Uploads business images: cover, avatar, staff avatar, portfolio. */
export const POST = api(async (req) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  await limit(req, "upload", 60, 3600, access.userId);
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File)) throw badRequest("לא נבחר קובץ");
  const prefix = `biz/${access.businessId}`;
  if (kind === "cover" || kind === "avatar") {
    const key = await saveImage(file, prefix, kind === "cover" ? 1800 : 600);
    await prisma.business.update({
      where: { id: access.businessId },
      data: kind === "cover" ? { coverPath: key } : { avatarPath: key },
    });
    return { key };
  }
  if (kind === "staff") {
    const staffId = String(form.get("staffId") ?? "");
    const staff = await prisma.staffMember.findFirst({ where: { id: staffId, businessId: access.businessId } });
    if (!staff) throw notFound("איש הצוות");
    const key = await saveImage(file, prefix, 600);
    await prisma.staffMember.update({ where: { id: staff.id }, data: { avatarPath: key } });
    return { key };
  }
  if (kind === "portfolio") {
    if (form.get("rightsConfirmed") !== "true") throw badRequest("יש לאשר זכויות שימוש והסכמת המצולמים");
    const key = await saveImage(file, prefix, 1600);
    const item = await prisma.portfolioItem.create({
      data: { businessId: access.businessId, imagePath: key, caption: String(form.get("caption") ?? "").slice(0, 200) },
    });
    return { id: item.id, key };
  }
  throw badRequest("סוג תמונה לא מוכר");
});
