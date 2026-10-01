import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";
import { createManualBooking } from "@/server/booking";

export const GET = api(async (req) => {
  const access = await requireBusinessAccess();
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? Date.now());
  const to = new Date(url.searchParams.get("to") ?? Date.now() + 7 * 86400_000);
  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: access.businessId,
      ...(access.role === "STAFF" ? { staffId: access.staffId ?? "-" } : {}),
      startsAt: { gte: from, lt: to },
    },
    orderBy: { startsAt: "asc" },
    include: { customer: { select: { name: true } }, staff: { select: { name: true } } },
  });
  return { appointments };
});

const Body = z.object({
  serviceId: z.string(),
  staffId: z.string(),
  startsAt: z.string().datetime(),
  guestName: z.string().trim().min(2, "נא להזין שם לקוח").max(60),
  guestPhone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

/** Manual booking for phone/walk-in customers. */
export const POST = api(async (req) => {
  const access = await requireBusinessAccess();
  const b = await parseJson(req, Body);
  if (access.role === "STAFF" && b.staffId !== access.staffId) b.staffId = access.staffId ?? "-";
  const a = await createManualBooking({ ...b, businessId: access.businessId, actorId: access.userId });
  return { id: a.id };
});
