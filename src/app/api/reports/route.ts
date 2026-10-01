import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, limit, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";

const Body = z.object({
  targetType: z.enum(["REEL", "BUSINESS"]),
  targetId: z.string().min(1),
  reason: z.string().trim().min(2).max(60),
  details: z.string().trim().max(1000).optional(),
});

export const POST = api(async (req) => {
  const user = await requireUser();
  await limit(req, "report", 20, 3600, user.id);
  const b = await parseJson(req, Body);
  const exists =
    b.targetType === "REEL"
      ? await prisma.reel.count({ where: { id: b.targetId } })
      : await prisma.business.count({ where: { id: b.targetId } });
  if (!exists) throw notFound();
  await prisma.report.create({
    data: { reporterId: user.id, targetType: b.targetType, targetId: b.targetId, reason: b.reason, details: b.details ?? "" },
  });
  return { ok: true };
});
