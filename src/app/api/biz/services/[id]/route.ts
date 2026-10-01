import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";
import { ServiceBody, assertStaffInBusiness } from "../schema";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Editing a service never touches existing appointments: they keep their own
 * snapshot of name, price, duration, buffer and cancellation policy.
 */
export const PUT = api<Ctx>(async (req, { params }) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { id } = await params;
  const svc = await prisma.service.findFirst({ where: { id, businessId: access.businessId } });
  if (!svc) throw notFound("השירות");
  const { staffIds, ...b } = await parseJson(req, ServiceBody);
  await assertStaffInBusiness(access.businessId, staffIds);
  await prisma.$transaction([
    prisma.service.update({ where: { id }, data: b }),
    prisma.staffService.deleteMany({ where: { serviceId: id } }),
    prisma.staffService.createMany({ data: staffIds.map((staffId) => ({ staffId, serviceId: id })) }),
  ]);
  return { ok: true };
});

/** Soft delete: keeps history intact; the service disappears from booking. */
export const DELETE = api<Ctx>(async (_req, { params }) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { id } = await params;
  const r = await prisma.service.updateMany({ where: { id, businessId: access.businessId }, data: { active: false } });
  if (!r.count) throw notFound("השירות");
  return { ok: true };
});
