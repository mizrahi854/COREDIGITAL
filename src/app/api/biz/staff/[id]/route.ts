import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

const Range = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});
const Body = z.object({
  name: z.string().trim().min(2).max(60),
  title: z.string().trim().max(60),
  active: z.boolean(),
  serviceIds: z.array(z.string()).max(100),
  workingHours: z.array(Range).max(21).refine((a) => a.every((r) => r.endMin > r.startMin), "שעת סיום חייבת להיות אחרי שעת התחלה"),
  breaks: z.array(Range.extend({ label: z.string().max(30).default("הפסקה") })).max(21).refine((a) => a.every((r) => r.endMin > r.startMin), "הפסקה לא תקינה"),
});

async function own(id: string, businessId: string) {
  const s = await prisma.staffMember.findFirst({ where: { id, businessId } });
  if (!s) throw notFound("איש הצוות");
  return s;
}

export const PUT = api<Ctx>(async (req, { params }) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { id } = await params;
  await own(id, access.businessId);
  const b = await parseJson(req, Body);
  const services = await prisma.service.findMany({ where: { id: { in: b.serviceIds }, businessId: access.businessId }, select: { id: true } });
  await prisma.$transaction([
    prisma.staffMember.update({ where: { id }, data: { name: b.name, title: b.title, active: b.active } }),
    prisma.staffService.deleteMany({ where: { staffId: id } }),
    prisma.staffService.createMany({ data: services.map((s) => ({ staffId: id, serviceId: s.id })) }),
    prisma.workingHours.deleteMany({ where: { staffId: id } }),
    prisma.workingHours.createMany({ data: b.workingHours.map((w) => ({ ...w, staffId: id })) }),
    prisma.staffBreak.deleteMany({ where: { staffId: id } }),
    prisma.staffBreak.createMany({ data: b.breaks.map((w) => ({ ...w, staffId: id })) }),
  ]);
  return { ok: true };
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { id } = await params;
  await own(id, access.businessId);
  // Deactivate rather than delete: past appointments reference the staff member.
  await prisma.staffMember.update({ where: { id }, data: { active: false } });
  return { ok: true };
});
