import { FeedPage } from "@/components/reels/feed-page";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string; reel?: string }> }) {
  const sp = await searchParams;
  return <FeedPage tab={sp.tab === "following" ? "following" : "local"} pinnedReelId={sp.reel} />;
}
