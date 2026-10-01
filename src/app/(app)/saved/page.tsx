import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/format";
import { getUser } from "@/server/auth";
import { publicReelWhere } from "@/server/feed";
import { SavedView } from "@/components/saved-view";

export const metadata: Metadata = { title: "שמורים" };

export default async function SavedPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/saved");
  const [reels, businesses, collections] = await Promise.all([
    prisma.savedReel.findMany({
      where: { userId: user.id, reel: publicReelWhere },
      orderBy: { createdAt: "desc" },
      select: { reel: { select: { id: true, thumbPath: true, caption: true, isSample: true, business: { select: { name: true, slug: true } }, service: { select: { id: true } } } } },
    }),
    prisma.savedBusiness.findMany({
      where: { userId: user.id, business: { status: "APPROVED" } },
      orderBy: { createdAt: "desc" },
      select: { business: { select: { id: true, slug: true, name: true, city: true, avatarPath: true, tagline: true } } },
    }),
    prisma.collection.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: { select: { reelId: true } } } }),
  ]);
  return (
    <SavedView
      reels={reels.map(({ reel: r }) => ({
        id: r.id,
        thumbUrl: mediaUrl(r.thumbPath),
        caption: r.caption,
        isSample: r.isSample,
        businessName: r.business.name,
        bookHref: `/b/${r.business.slug}/book?reel=${r.id}${r.service ? `&service=${r.service.id}` : ""}`,
      }))}
      businesses={businesses.map(({ business: b }) => ({ ...b, avatarUrl: mediaUrl(b.avatarPath) }))}
      collections={collections.map((c) => ({ id: c.id, name: c.name, reelIds: c.items.map((i) => i.reelId) }))}
    />
  );
}
