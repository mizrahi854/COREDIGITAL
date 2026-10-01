import { z } from "zod";
import { api, limit } from "@/server/http";
import { nextAvailableDates } from "@/server/availability";

const Q = z.object({ businessId: z.string(), serviceId: z.string(), staffId: z.string().optional() });

export const GET = api(async (req) => {
  await limit(req, "availability", 300, 60);
  const p = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const days = await nextAvailableDates({ businessId: p.businessId, serviceId: p.serviceId, staffId: p.staffId || null }, 21);
  return { days };
});
