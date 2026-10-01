import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime(), reason: z.string().max(80).default("") });

export const POST = api<Ctx>(async (req, { params }) => {
  const access = await requireBusinessAccess();
  const { id } = await params;
  // Owners manage everyone; staff may add time off for themselves only.
  if (access.role === "STAFF" && access.staffId !== id) throw notFound("איש הצוות");
  const s = await prisma.staffMember.findFirst({ where: { id, businessId: access.businessId } });
  if (!s) throw notFound("איש הצוות");
  const b = await parseJson(req, Body);
  if (new Date(b.endsAt) <= new Date(b.startsAt)) throw badRequest("טווח זמנים לא תקין");
  const conflicts = await prisma.appointment.count({
    where: { staffId: id, status: "CONFIRMED", startsAt: { lt: new Date(b.endsAt) }, blockEndsAt: { gt: new Date(b.startsAt) } },
  });
  const t = await prisma.timeOff.create({ data: { staffId: id, startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt), reason: b.reason } });
  return { id: t.id, conflictingAppointments: conflicts };
});

export const DELETE = api<Ctx>(async (req, { params }) => {
  const access = await requireBusinessAccess();
  const { id } = await params;
  if (access.role === "STAFF" && access.staffId !== id) throw notFound("איש הצוות");
  const timeOffId = new URL(req.url).searchParams.get("timeOffId") ?? "";
  const r = await prisma.timeOff.deleteMany({ where: { id: timeOffId, staffId: id, staff: { businessId: access.businessId } } });
  if (!r.count) throw notFound();
  return { ok: true };
});
