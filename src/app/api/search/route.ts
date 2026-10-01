import { z } from "zod";
import { CATEGORY_IDS } from "@/lib/constants";
import { api, limit } from "@/server/http";
import { getUser } from "@/server/auth";
import { searchBusinesses } from "@/server/search";

const num = z.coerce.number().optional();
const Q = z.object({
  q: z.string().max(80).optional(),
  city: z.string().max(60).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  service: z.string().max(60).optional(),
  minPrice: num,
  maxPrice: num,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  today: z.enum(["1"]).optional(),
  reviewsOnly: z.enum(["1"]).optional(),
  lat: num,
  lng: num,
  maxKm: num,
});

export const GET = api(async (req) => {
  await limit(req, "search", 120, 60);
  const raw = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const p = Q.parse(raw);
  const user = await getUser();
  const results = await searchBusinesses({
    ...p,
    today: p.today === "1",
    reviewsOnly: p.reviewsOnly === "1",
    userId: user?.id,
  });
  return { results };
});
