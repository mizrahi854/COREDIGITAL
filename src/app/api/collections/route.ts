import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";

export const GET = api(async () => {
  const user = await requireUser();
  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { reelId: true } } },
  });
  return { collections: collections.map((c) => ({ id: c.id, name: c.name, reelIds: c.items.map((i) => i.reelId) })) };
});

const Body = z.object({ name: z.string().trim().min(1, "נא לתת שם לאוסף").max(40), reelId: z.string().optional() });

export const POST = api(async (req) => {
  const user = await requireUser();
  const b = await parseJson(req, Body);
  const count = await prisma.collection.count({ where: { userId: user.id } });
  if (count >= 50) throw new Error("too many collections");
  const c = await prisma.collection.create({ data: { userId: user.id, name: b.name } });
  if (b.reelId) {
    await prisma.savedReel.upsert({
      where: { userId_reelId: { userId: user.id, reelId: b.reelId } },
      create: { userId: user.id, reelId: b.reelId },
      update: {},
    });
    await prisma.collectionItem.create({ data: { collectionId: c.id, reelId: b.reelId } });
  }
  return { id: c.id, name: c.name };
});
