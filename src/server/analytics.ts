import type { AnalyticsType } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Records an event; views are de-duplicated per visitor per 30 minutes. */
export async function track(e: {
  type: AnalyticsType;
  businessId: string;
  reelId?: string | null;
  userId?: string | null;
  visitorKey?: string | null;
}) {
  if (e.visitorKey) {
    const recent = await prisma.analyticsEvent.findFirst({
      where: {
        type: e.type,
        businessId: e.businessId,
        reelId: e.reelId ?? null,
        visitorKey: e.visitorKey,
        createdAt: { gt: new Date(Date.now() - 30 * 60_000) },
      },
      select: { id: true },
    });
    if (recent) return;
  }
  await prisma.analyticsEvent.create({
    data: {
      type: e.type,
      businessId: e.businessId,
      reelId: e.reelId ?? null,
      userId: e.userId ?? null,
      visitorKey: e.visitorKey ?? null,
    },
  });
}

export async function businessAnalytics(businessId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const [events, appts, payments, reels] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: { businessId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.appointment.findMany({
      where: { businessId, createdAt: { gte: since } },
      select: { status: true, priceAgorot: true, sourceReelId: true, source: true },
    }),
    prisma.paymentRecord.aggregate({
      where: { appointment: { businessId }, createdAt: { gte: since } },
      _sum: { amountAgorot: true },
    }),
    prisma.reel.findMany({
      where: { businessId, status: "PUBLISHED" },
      select: {
        id: true,
        caption: true,
        thumbPath: true,
        _count: { select: { likes: true, saves: true } },
      },
    }),
  ]);
  const count = (t: AnalyticsType) => events.find((e) => e.type === t)?._count ?? 0;
  const confirmed = appts.filter((a) => a.status === "CONFIRMED" || a.status === "COMPLETED");
  const completed = appts.filter((a) => a.status === "COMPLETED");

  const reelViews = await prisma.analyticsEvent.groupBy({
    by: ["reelId"],
    where: { businessId, type: "REEL_VIEW", createdAt: { gte: since }, reelId: { not: null } },
    _count: true,
  });
  const reelStarts = await prisma.analyticsEvent.groupBy({
    by: ["reelId"],
    where: { businessId, type: "BOOKING_START", createdAt: { gte: since }, reelId: { not: null } },
    _count: true,
  });

  const perReel = reels
    .map((r) => {
      const fromReel = appts.filter((a) => a.sourceReelId === r.id);
      return {
        id: r.id,
        caption: r.caption,
        thumbPath: r.thumbPath,
        likes: r._count.likes,
        saves: r._count.saves,
        views: reelViews.find((v) => v.reelId === r.id)?._count ?? 0,
        bookingStarts: reelStarts.find((v) => v.reelId === r.id)?._count ?? 0,
        bookings: fromReel.filter((a) => a.status === "CONFIRMED" || a.status === "COMPLETED").length,
        requests: fromReel.length,
      };
    })
    .sort((a, b) => b.bookings - a.bookings || b.views - a.views);

  return {
    days,
    reelViews: count("REEL_VIEW"),
    profileVisits: count("PROFILE_VIEW"),
    bookingStarts: count("BOOKING_START"),
    confirmed: confirmed.length,
    completed: completed.length,
    cancelled: appts.filter((a) => a.status === "CANCELLED").length,
    fromReels: confirmed.filter((a) => a.sourceReelId).length,
    expectedValueAgorot: confirmed.reduce((s, a) => s + a.priceAgorot, 0),
    paidAgorot: payments._sum.amountAgorot ?? 0,
    perReel,
  };
}
