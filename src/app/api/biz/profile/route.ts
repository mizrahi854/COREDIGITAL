import { z } from "zod";
import { prisma } from "@/lib/db";
import { CATEGORY_IDS } from "@/lib/constants";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";

const Body = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1500),
  categories: z.array(z.enum(CATEGORY_IDS)).min(1).max(4),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().max(120),
  phone: z.string().trim().max(20).optional(),
  instagram: z.string().trim().max(60).optional(),
  lat: z.number().min(29).max(34).nullable().optional(),
  lng: z.number().min(34).max(36).nullable().optional(),
  cancellationHours: z.number().int().min(0).max(168),
  cancellationPolicy: z.string().trim().min(5).max(400),
  openingHours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), openMin: z.number().int().min(0).max(1440), closeMin: z.number().int().min(0).max(1440) }))
    .max(14)
    .refine((a) => a.every((h) => h.closeMin > h.openMin), "שעת סגירה חייבת להיות אחרי שעת פתיחה"),
});

export const PUT = api(async (req) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { openingHours, ...b } = await parseJson(req, Body);
  await prisma.$transaction([
    prisma.business.update({ where: { id: access.businessId }, data: b }),
    prisma.openingHours.deleteMany({ where: { businessId: access.businessId } }),
    prisma.openingHours.createMany({ data: openingHours.map((h) => ({ ...h, businessId: access.businessId })) }),
  ]);
  return { ok: true };
});
