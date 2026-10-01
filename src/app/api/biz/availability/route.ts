import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";
import { getSlots } from "@/server/availability";

const Q = z.object({
  serviceId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().optional(),
  exclude: z.string().optional(),
  durationMin: z.coerce.number().int().min(5).max(600).optional(),
});

/** Business-side slot lookup (manual bookings, rescheduling, proposals). Ignores the customer lead time. */
export const GET = api(async (req) => {
  const access = await requireBusinessAccess();
  const p = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  let durationMin = p.durationMin;
  if (p.exclude) {
    const a = await prisma.appointment.findFirst({ where: { id: p.exclude, businessId: access.businessId } });
    if (!a) throw notFound("התור");
    durationMin ??= a.durationMin;
  }
  const slots = await getSlots({
    businessId: access.businessId,
    serviceId: p.serviceId,
    date: p.date,
    staffId: access.role === "STAFF" ? access.staffId : p.staffId || null,
    excludeAppointmentId: p.exclude,
    durationMin,
    ignoreLeadTime: true,
  });
  return { slots };
});
