import { prisma } from "@/lib/db";
import { getUser } from "@/server/auth";
import { getFeed, publicReelWhere, reelSelect, toReelDTO, viewerState } from "@/server/feed";
import { ReelFeed } from "./reel-feed";

export async function FeedPage({ tab, pinnedReelId }: { tab: "local" | "following"; pinnedReelId?: string }) {
  const user = await getUser();
  const feed = await getFeed({ userId: user?.id, tab, city: user?.city, interests: user?.interests ?? [] });
  let items = feed.items;
  if (pinnedReelId) {
    const r = await prisma.reel.findFirst({ where: { id: pinnedReelId, ...publicReelWhere }, select: reelSelect });
    if (r) {
      const me = await viewerState(user?.id, [r.id]);
      items = [toReelDTO(r, me), ...items.filter((x) => x.id !== r.id)];
    }
  }
  return <ReelFeed key={tab + (pinnedReelId ?? "")} initial={items} initialCursor={feed.nextCursor} tab={tab} pinnedReelId={pinnedReelId} />;
}
