import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { FeedPage } from "@/components/reels/feed-page";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await prisma.reel.findUnique({ where: { id }, select: { caption: true, business: { select: { name: true } } } });
  return r ? { title: `${r.business.name}`, description: r.caption } : {};
}

export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeedPage tab="local" pinnedReelId={id} />;
}
