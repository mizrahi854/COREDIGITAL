import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, limit, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { publicReelWhere } from "@/server/feed";

const Body = z.object({
  action: z.enum(["like", "save", "follow", "saveBusiness", "block"]),
  targetId: z.string().min(1),
  on: z.boolean(),
});

/** Idempotent social toggles. Authentication is required for all of them. */
export const POST = api(async (req) => {
  const user = await requireUser();
  await limit(req, "social", 120, 60, user.id);
  const { action, targetId, on } = await parseJson(req, Body);
  const userId = user.id;

  if (action === "like" || action === "save") {
    const reel = await prisma.reel.findFirst({ where: { id: targetId, ...publicReelWhere }, select: { id: true } });
    if (!reel && on) throw notFound("הסרטון");
    const key = { userId_reelId: { userId, reelId: targetId } };
    if (action === "like") {
      if (on) await prisma.like.upsert({ where: key, create: { userId, reelId: targetId }, update: {} });
      else await prisma.like.deleteMany({ where: { userId, reelId: targetId } });
    } else {
      if (on) await prisma.savedReel.upsert({ where: key, create: { userId, reelId: targetId }, update: {} });
      else {
        await prisma.savedReel.deleteMany({ where: { userId, reelId: targetId } });
        await prisma.collectionItem.deleteMany({ where: { reelId: targetId, collection: { userId } } });
      }
    }
    const likeCount = await prisma.like.count({ where: { reelId: targetId } });
    return { ok: true, likeCount };
  }

  const biz = await prisma.business.findFirst({ where: { id: targetId, status: "APPROVED" }, select: { id: true } });
  if (!biz && on) throw notFound("העסק");
  const key = { userId_businessId: { userId, businessId: targetId } };
  const data = { userId, businessId: targetId };
  if (action === "follow") {
    if (on) await prisma.follow.upsert({ where: key, create: data, update: {} });
    else await prisma.follow.deleteMany({ where: data });
  } else if (action === "saveBusiness") {
    if (on) await prisma.savedBusiness.upsert({ where: key, create: data, update: {} });
    else await prisma.savedBusiness.deleteMany({ where: data });
  } else {
    if (on) {
      await prisma.block.upsert({ where: key, create: data, update: {} });
      await prisma.follow.deleteMany({ where: data });
    } else await prisma.block.deleteMany({ where: data });
  }
  return { ok: true };
});
