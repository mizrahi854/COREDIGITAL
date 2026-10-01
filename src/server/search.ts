import type { Category, Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { BUSINESS_TZ } from "@/lib/constants";
import { haversineKm, mediaUrl } from "@/lib/format";
import { getSlots } from "./availability";

export type SearchParams = {
  q?: string;
  city?: string;
  category?: Category;
  service?: string;
  minPrice?: number; // shekels
  maxPrice?: number;
  date?: string; // YYYY-MM-DD
  timeFrom?: string; // HH:mm
  timeTo?: string;
  today?: boolean;
  reviewsOnly?: boolean;
  lat?: number;
  lng?: number;
  maxKm?: number;
  userId?: string | null;
};

const AVAILABILITY_CANDIDATES = 40;

export async function searchBusinesses(p: SearchParams) {
  const q = p.q?.trim();
  const serviceText = p.service?.trim();
  const blocked = p.userId
    ? (await prisma.block.findMany({ where: { userId: p.userId }, select: { businessId: true } })).map(
        (b) => b.businessId,
      )
    : [];

  const serviceFilter: Prisma.ServiceWhereInput = {
    active: true,
    ...(serviceText ? { name: { contains: serviceText, mode: "insensitive" } } : {}),
    ...(p.category ? { category: p.category } : {}),
    ...(p.minPrice != null || p.maxPrice != null
      ? {
          priceAgorot: {
            ...(p.minPrice != null ? { gte: Math.round(p.minPrice * 100) } : {}),
            ...(p.maxPrice != null ? { lte: Math.round(p.maxPrice * 100) } : {}),
          },
        }
      : {}),
  };
  const hasServiceFilter = !!(serviceText || p.minPrice != null || p.maxPrice != null);

  const where: Prisma.BusinessWhereInput = {
    status: "APPROVED",
    id: { notIn: blocked },
    ...(p.city ? { city: p.city } : {}),
    ...(p.category ? { categories: { has: p.category } } : {}),
    ...(hasServiceFilter ? { services: { some: serviceFilter } } : {}),
    ...(p.reviewsOnly ? { reviews: { some: {} } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { tagline: { contains: q, mode: "insensitive" } },
            { services: { some: { active: true, name: { contains: q, mode: "insensitive" } } } },
            { services: { some: { active: true, styleTags: { has: q } } } },
            { reels: { some: { status: "PUBLISHED", tags: { has: q.replace(/^#/, "") } } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.business.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      city: true,
      address: true,
      lat: true,
      lng: true,
      categories: true,
      coverPath: true,
      avatarPath: true,
      isDemo: true,
      verified: true,
      services: {
        where: hasServiceFilter ? serviceFilter : { active: true },
        orderBy: { priceAgorot: "asc" },
        select: { id: true, name: true, priceAgorot: true, durationMin: true, mode: true },
      },
      reels: {
        where: { status: "PUBLISHED", hiddenByAdmin: false },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: { id: true, thumbPath: true },
      },
      _count: { select: { reviews: true, followers: true } },
    },
    take: 100,
  });

  const origin = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;
  let results = rows.map((b) => ({
    ...b,
    coverUrl: mediaUrl(b.coverPath),
    avatarUrl: mediaUrl(b.avatarPath),
    reelThumbs: b.reels.map((r) => ({ id: r.id, url: mediaUrl(r.thumbPath) })),
    // Distance only when both sides have real coordinates — never invented.
    distanceKm: origin && b.lat != null && b.lng != null ? haversineKm(origin, { lat: b.lat, lng: b.lng }) : null,
    nextSlot: null as null | { start: string; serviceName: string },
  }));

  if (origin && p.maxKm) {
    results = results.filter((r) => r.distanceKm != null && r.distanceKm <= p.maxKm!);
  }

  const date = p.today ? DateTime.now().setZone(BUSINESS_TZ).toISODate()! : p.date;
  if (date) {
    const fromMin = p.timeFrom ? toMin(p.timeFrom) : 0;
    const toMinV = p.timeTo ? toMin(p.timeTo) : 24 * 60;
    const candidates = results.slice(0, AVAILABILITY_CANDIDATES);
    const withSlots = await Promise.all(
      candidates.map(async (b) => {
        for (const s of b.services.slice(0, 4)) {
          const slots = await getSlots({ businessId: b.id, serviceId: s.id, date });
          const hit = slots.find((sl) => {
            const local = DateTime.fromISO(sl.start).setZone(BUSINESS_TZ);
            const m = local.hour * 60 + local.minute;
            return m >= fromMin && m < toMinV;
          });
          if (hit) return { ...b, nextSlot: { start: hit.start, serviceName: s.name } };
        }
        return null;
      }),
    );
    results = withSlots.filter((x): x is NonNullable<typeof x> => x !== null);
  }

  if (origin) {
    results.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return results.map(({ reels, lat, lng, ...rest }) => rest);
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export async function anyReviewsExist() {
  return (await prisma.review.count()) > 0;
}
