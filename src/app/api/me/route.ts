import { z } from "zod";
import { prisma } from "@/lib/db";
import { CATEGORY_IDS } from "@/lib/constants";
import { api, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";

const Body = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  city: z.string().trim().max(60).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  interests: z.array(z.enum(CATEGORY_IDS)).max(10).optional(),
  onboarded: z.boolean().optional(),
});

export const PATCH = api(async (req) => {
  const user = await requireUser();
  const { onboarded, ...b } = await parseJson(req, Body);
  await prisma.user.update({
    where: { id: user.id },
    data: { ...b, ...(onboarded ? { onboardedAt: new Date() } : {}) },
  });
  return { ok: true };
});
