import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/format";
import { getUser } from "@/server/auth";
import { publicReelWhere } from "@/server/feed";
import { BookingFlow } from "@/components/booking/booking-flow";
import { TrackEvent } from "@/components/business-actions";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; staff?: string; reel?: string; date?: string; time?: string }>;
};

export const metadata: Metadata = { title: "קביעת תור" };

export default async function BookPage({ params, searchParams }: Props) {
  const [{ slug }, sp, user] = await Promise.all([params, searchParams, getUser()]);
  const b = await prisma.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: { staff: { select: { staffId: true } } } },
      staff: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!b || b.status !== "APPROVED") notFound();

  const sourceReel = sp.reel
    ? await prisma.reel.findFirst({
        where: { id: sp.reel, businessId: b.id, ...publicReelWhere },
        select: { id: true, thumbPath: true, caption: true, serviceId: true },
      })
    : null;

  const saved = user
    ? await prisma.savedReel.findMany({
        where: { userId: user.id, reel: publicReelWhere },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: { reel: { select: { id: true, thumbPath: true, caption: true, business: { select: { name: true } } } } },
      })
    : [];

  const activeStaffIds = new Set(b.staff.map((s) => s.id));
  return (
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8 md:pt-10">
      {sourceReel ? null : <TrackEvent type="BOOKING_START" businessId={b.id} />}
      <BookingFlow
        business={{
          id: b.id,
          slug: b.slug,
          name: b.name,
          address: [b.address, b.city].filter(Boolean).join(", "),
          avatarUrl: mediaUrl(b.avatarPath),
          cancellationPolicy: b.cancellationPolicy,
          timezone: b.timezone,
          isDemo: b.isDemo,
        }}
        services={b.services
          .map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            priceAgorot: s.priceAgorot,
            durationMin: s.durationMin,
            mode: s.mode,
            staffIds: s.staff.map((x) => x.staffId).filter((id) => activeStaffIds.has(id)),
          }))
          .filter((s) => s.staffIds.length > 0)}
        staff={b.staff.map((s) => ({ id: s.id, name: s.name, title: s.title, avatarUrl: mediaUrl(s.avatarPath) }))}
        initial={{
          serviceId: sp.service ?? sourceReel?.serviceId ?? null,
          staffId: sp.staff ?? null,
          date: sp.date ?? null,
          time: sp.time ?? null,
        }}
        sourceReel={sourceReel ? { id: sourceReel.id, thumbUrl: mediaUrl(sourceReel.thumbPath), caption: sourceReel.caption } : null}
        savedReels={saved.map((s) => ({
          id: s.reel.id,
          thumbUrl: mediaUrl(s.reel.thumbPath),
          caption: s.reel.caption,
          businessName: s.reel.business.name,
        }))}
        signedIn={!!user}
      />
    </main>
  );
}
