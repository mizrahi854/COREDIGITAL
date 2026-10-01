import type { Category, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/format";

/** Visibility rule shared by feed, profile, search and saved content. */
export const publicReelWhere: Prisma.ReelWhereInput = {
  status: "PUBLISHED",
  hiddenByAdmin: false,
  videoPath: { not: null },
  business: { status: "APPROVED" },
};

export const reelSelect = {
  id: true,
  caption: true,
  tags: true,
  category: true,
  videoPath: true,
  webmPath: true,
  thumbPath: true,
  isSample: true,
  publishedAt: true,
  width: true,
  height: true,
  business: {
    select: { id: true, slug: true, name: true, city: true, avatarPath: true, isDemo: true, verified: true },
  },
  service: {
    select: { id: true, name: true, priceAgorot: true, durationMin: true, mode: true, active: true },
  },
  staff: { select: { id: true, name: true } },
  _count: { select: { likes: true } },
} satisfies Prisma.ReelSelect;

type ReelRow = Prisma.ReelGetPayload<{ select: typeof reelSelect }>;

export type ReelDTO = ReturnType<typeof toReelDTO>;

export function toReelDTO(
  r: ReelRow,
  me?: { liked: Set<string>; saved: Set<string>; following: Set<string> },
  reason?: string,
) {
  return {
    id: r.id,
    caption: r.caption,
    tags: r.tags,
    category: r.category,
    videoUrl: mediaUrl(r.videoPath)!,
    webmUrl: mediaUrl(r.webmPath),
    thumbUrl: mediaUrl(r.thumbPath),
    isSample: r.isSample,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    business: { ...r.business, avatarUrl: mediaUrl(r.business.avatarPath) },
    service: r.service && r.service.active ? r.service : null,
    staff: r.staff,
    likeCount: r._count.likes,
    liked: me?.liked.has(r.id) ?? false,
    saved: me?.saved.has(r.id) ?? false,
    following: me?.following.has(r.business.id) ?? false,
    reason: reason ?? null,
  };
}

export async function viewerState(userId: string | null | undefined, reelIds: string[]) {
  if (!userId) return undefined;
  const [likes, saves, follows] = await Promise.all([
    prisma.like.findMany({ where: { userId, reelId: { in: reelIds } }, select: { reelId: true } }),
    prisma.savedReel.findMany({ where: { userId, reelId: { in: reelIds } }, select: { reelId: true } }),
    prisma.follow.findMany({ where: { userId }, select: { businessId: true } }),
  ]);
  return {
    liked: new Set(likes.map((l) => l.reelId)),
    saved: new Set(saves.map((s) => s.reelId)),
    following: new Set(follows.map((f) => f.businessId)),
  };
}

/**
 * Transparent ordering for v1 — no opaque model:
 *   score = freshness (half-life 7 days)
 *         + 2.0 if you follow the business
 *         + 1.5 if the business is in your area
 *         + 1.0 if the category matches your interests
 * The strongest reason is shown on the reel ("why am I seeing this").
 */
export async function getFeed(opts: {
  userId?: string | null;
  tab: "local" | "following";
  city?: string | null;
  interests?: Category[];
  cursor?: number;
  take?: number;
}) {
  const take = opts.take ?? 8;
  const offset = opts.cursor ?? 0;
  const blocked = opts.userId
    ? (await prisma.block.findMany({ where: { userId: opts.userId }, select: { businessId: true } })).map(
        (b) => b.businessId,
      )
    : [];
  const followed = opts.userId
    ? (await prisma.follow.findMany({ where: { userId: opts.userId }, select: { businessId: true } })).map(
        (f) => f.businessId,
      )
    : [];

  if (opts.tab === "following") {
    if (followed.length === 0) return { items: [], nextCursor: null };
    const rows = await prisma.reel.findMany({
      where: { ...publicReelWhere, businessId: { in: followed, notIn: blocked } },
      select: reelSelect,
      orderBy: { publishedAt: "desc" },
      skip: offset,
      take: take + 1,
    });
    const page = rows.slice(0, take);
    const me = await viewerState(opts.userId, page.map((r) => r.id));
    return {
      items: page.map((r) => toReelDTO(r, me, "עסק שאת/ה עוקב/ת אחריו")),
      nextCursor: rows.length > take ? offset + take : null,
    };
  }

  const rows = await prisma.reel.findMany({
    where: { ...publicReelWhere, businessId: { notIn: blocked } },
    select: reelSelect,
    orderBy: { publishedAt: "desc" },
    take: 300,
  });
  const now = Date.now();
  const interests = new Set(opts.interests ?? []);
  const scored = rows.map((r) => {
    const ageDays = (now - (r.publishedAt?.getTime() ?? now)) / 86400_000;
    const fresh = Math.pow(0.5, ageDays / 7);
    const isFollowed = followed.includes(r.business.id);
    const isLocal = !!opts.city && r.business.city === opts.city;
    const isInterest = interests.has(r.category);
    const score = fresh + (isFollowed ? 2 : 0) + (isLocal ? 1.5 : 0) + (isInterest ? 1 : 0);
    const reason = isFollowed
      ? "עסק שאת/ה עוקב/ת אחריו"
      : isLocal
        ? `באזור שלך · ${r.business.city}`
        : isInterest
          ? "לפי תחומי העניין שלך"
          : "חדש ב־BUBER";
    return { r, score, reason };
  });
  scored.sort((a, b) => b.score - a.score || (b.r.publishedAt?.getTime() ?? 0) - (a.r.publishedAt?.getTime() ?? 0));
  const page = scored.slice(offset, offset + take);
  const me = await viewerState(opts.userId, page.map((p) => p.r.id));
  return {
    items: page.map((p) => toReelDTO(p.r, me, p.reason)),
    nextCursor: offset + take < scored.length ? offset + take : null,
  };
}
