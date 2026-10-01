import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, limit } from "@/server/http";
import { getSlots } from "@/server/availability";
import { getUser } from "@/server/auth";

const Q = z.object({
  businessId: z.string(),
  serviceId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().optional(),
  exclude: z.string().optional(),
});

export const GET = api(async (req) => {
  await limit(req, "availability", 300, 60);
  const p = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  let excludeAppointmentId: string | undefined;
  let durationMin: number | undefined;
  if (p.exclude) {
    // Only the owner of the appointment may exclude it (rescheduling).
    const user = await getUser();
    const a = await prisma.appointment.findFirst({ where: { id: p.exclude, customerId: user?.id ?? "-" } });
    if (!a) throw notFound("התור");
    excludeAppointmentId = a.id;
    durationMin = a.durationMin;
  }
  const slots = await getSlots({
    businessId: p.businessId,
    serviceId: p.serviceId,
    date: p.date,
    staffId: p.staffId || null,
    excludeAppointmentId,
    durationMin,
  });
  return { slots };
});
