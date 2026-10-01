import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { publicReelWhere } from "@/server/feed";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ reelId: z.string().min(1), on: z.boolean() });

export const POST = api<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const c = await prisma.collection.findFirst({ where: { id, userId: user.id } });
  if (!c) throw notFound("האוסף");
  const b = await parseJson(req, Body);
  if (b.on) {
    const reel = await prisma.reel.findFirst({ where: { id: b.reelId, ...publicReelWhere } });
    if (!reel) throw notFound("הסרטון");
    await prisma.savedReel.upsert({
      where: { userId_reelId: { userId: user.id, reelId: b.reelId } },
      create: { userId: user.id, reelId: b.reelId },
      update: {},
    });
    await prisma.collectionItem.upsert({
      where: { collectionId_reelId: { collectionId: id, reelId: b.reelId } },
      create: { collectionId: id, reelId: b.reelId },
      update: {},
    });
  } else {
    await prisma.collectionItem.deleteMany({ where: { collectionId: id, reelId: b.reelId } });
  }
  return { ok: true };
});
