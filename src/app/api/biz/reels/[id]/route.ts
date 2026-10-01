import { z } from "zod";
import { prisma } from "@/lib/db";
import { CATEGORY_IDS } from "@/lib/constants";
import { conflict, notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";
import { storage } from "@/server/storage";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  caption: z.string().trim().max(300).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  serviceId: z.string().nullable().optional(),
  staffId: z.string().nullable().optional(),
  publish: z.boolean().optional(),
});

export const PATCH = api<Ctx>(async (req, { params }) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { id } = await params;
  const reel = await prisma.reel.findFirst({ where: { id, businessId: access.businessId } });
  if (!reel) throw notFound("הסרטון");
  const { publish, ...b } = await parseJson(req, Body);
  if (b.serviceId && !(await prisma.service.count({ where: { id: b.serviceId, businessId: access.businessId } })))
    throw notFound("השירות");
  if (b.staffId && !(await prisma.staffMember.count({ where: { id: b.staffId, businessId: access.businessId } })))
    throw notFound("איש הצוות");
  let statusData = {};
  if (publish === true) {
    if (reel.status === "PROCESSING") statusData = { publishWhenReady: true };
    else if (reel.status === "DRAFT" && reel.videoPath) statusData = { status: "PUBLISHED", publishedAt: new Date() };
    else if (reel.status !== "PUBLISHED") throw conflict("not_ready", "אי אפשר לפרסם סרטון שהעיבוד שלו נכשל");
  } else if (publish === false) {
    statusData = reel.status === "PUBLISHED" ? { status: "DRAFT", publishedAt: null } : { publishWhenReady: false };
  }
  await prisma.reel.update({ where: { id }, data: { ...b, ...statusData } });
  return { ok: true };
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { id } = await params;
  const reel = await prisma.reel.findFirst({ where: { id, businessId: access.businessId } });
  if (!reel) throw notFound("הסרטון");
  await prisma.reel.delete({ where: { id } });
  if (!reel.isSample) await storage.remove(`reels/${id}`);
  return { ok: true };
});
