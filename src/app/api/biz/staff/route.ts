import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";

const Body = z.object({
  name: z.string().trim().min(2, "נא להזין שם").max(60),
  title: z.string().trim().max(60).default(""),
  /** Optional: grant this person staff access by the email of their BUBER account. */
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
});

export const POST = api(async (req) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const b = await parseJson(req, Body);
  let userId: string | null = null;
  if (b.email) {
    const u = await prisma.user.findUnique({ where: { email: b.email } });
    if (!u) throw notFound("משתמש עם האימייל הזה");
    userId = u.id;
    await prisma.businessMember.upsert({
      where: { businessId_userId: { businessId: access.businessId, userId: u.id } },
      create: { businessId: access.businessId, userId: u.id, role: "STAFF" },
      update: {},
    });
  }
  const s = await prisma.staffMember.create({
    data: {
      businessId: access.businessId,
      name: b.name,
      title: b.title,
      userId,
      workingHours: { create: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 18 * 60 })) },
    },
  });
  return { id: s.id };
});
