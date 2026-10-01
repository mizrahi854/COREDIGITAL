import { z } from "zod";
import { api, limit, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { createBooking } from "@/server/booking";

const Body = z.object({
  businessId: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().nullable().optional(),
  startsAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  inspirationReelIds: z.array(z.string()).max(6).optional(),
  sourceReelId: z.string().nullable().optional(),
  source: z.enum(["PROFILE", "REEL", "SEARCH"]).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export const POST = api(async (req) => {
  const user = await requireUser();
  await limit(req, "booking", 30, 600, user.id);
  const b = await parseJson(req, Body);
  const { appointment, replayed } = await createBooking({ ...b, customerId: user.id });
  return { id: appointment.id, status: appointment.status, replayed };
});
