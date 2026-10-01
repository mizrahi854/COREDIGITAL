import { z } from "zod";
import { prisma } from "@/lib/db";
import { CATEGORY_IDS } from "@/lib/constants";
import { badRequest } from "@/lib/errors";

export const ServiceBody = z.object({
  name: z.string().trim().min(2, "נא להזין שם שירות").max(60),
  description: z.string().trim().max(500).default(""),
  category: z.enum(CATEGORY_IDS),
  styleTags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  mode: z.enum(["FIXED", "CONSULTATION"]),
  priceAgorot: z.number().int().min(0).max(10_000_000),
  durationMin: z.number().int().min(5).max(600),
  bufferMin: z.number().int().min(0).max(120),
  active: z.boolean().default(true),
  staffIds: z.array(z.string()).max(50),
});

export async function assertStaffInBusiness(businessId: string, staffIds: string[]) {
  if (!staffIds.length) return;
  const n = await prisma.staffMember.count({ where: { id: { in: staffIds }, businessId } });
  if (n !== new Set(staffIds).size) throw badRequest("איש צוות לא שייך לעסק");
}
