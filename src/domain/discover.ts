import { DateTime } from "luxon";
import type { Business, CategoryId, DB, ID, Post, Professional, User } from "./types";
import { getSlots } from "./booking";
import { TZ } from "./time";
import { businessServesCity, servesCity, visibleTo } from "./feed";
import { haversineKm } from "./format";

export interface DiscoverFilters {
  q: string;
  cityId: ID | null;
  /** Requires a geolocation fix; distances are never invented. */
  maxKm: number | null;
  category: CategoryId | null;
  serviceQuery: string;
  tags: string[];
  professionalId: ID | null;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number | null;
  date: string | null;
  today: boolean;
}

export const EMPTY_FILTERS: DiscoverFilters = {
  q: "",
  cityId: null,
  maxKm: null,
  category: null,
  serviceQuery: "",
  tags: [],
  professionalId: null,
  minPrice: null,
  maxPrice: null,
  minRating: null,
  date: null,
  today: false,
};

export function ratingOf(db: DB, businessId: ID) {
  const r = db.reviews.filter((x) => x.businessId === businessId && !x.hidden);
  return r.length ? { avg: r.reduce((s, x) => s + x.rating, 0) / r.length, count: r.length } : { avg: 0, count: 0 };
}

export function proRating(db: DB, proId: ID) {
  const r = db.reviews.filter((x) => x.professionalId === proId && !x.hidden);
  return r.length ? { avg: r.reduce((s, x) => s + x.rating, 0) / r.length, count: r.length } : { avg: 0, count: 0 };
}

export interface BusinessResult {
  business: Business;
  minPrice: number | null;
  rating: { avg: number; count: number };
  distanceKm: number | null;
  nextSlot: string | null;
  matchingPros: Professional[];
  thumbs: Post[];
}

const norm = (s: string) => s.toLowerCase().replace(/[#׳'"]/g, "").trim();

export function searchBusinesses(db: DB, viewer: User | null, f: DiscoverFilters, geo: { lat: number; lng: number } | null, now = new Date()): BusinessResult[] {
  const q = norm(f.q);
  const sq = norm(f.serviceQuery);
  const date = f.today ? DateTime.fromJSDate(now).setZone(TZ).toISODate()! : f.date;
  const out: BusinessResult[] = [];

  for (const b of db.businesses) {
    if (b.status !== "active") continue;
    if (viewer?.blockedBusinessIds.includes(b.id)) continue;
    if (f.cityId && !businessServesCity(b, f.cityId)) continue;
    if (f.category && !b.categories.includes(f.category)) continue;
    const services = db.services.filter((s) => s.businessId === b.id && s.active);
    let pros = db.professionals.filter((p) => p.businessId === b.id && p.active);
    if (f.professionalId) {
      pros = pros.filter((p) => p.id === f.professionalId);
      if (!pros.length) continue;
    }
    const proServiceIds = new Set(pros.flatMap((p) => p.serviceIds));
    let svc = services.filter((s) => proServiceIds.has(s.id));
    if (sq) svc = svc.filter((s) => norm(s.name).includes(sq));
    if (f.category) svc = svc.filter((s) => s.category === f.category || b.categories.includes(f.category!));
    if (f.minPrice != null) svc = svc.filter((s) => s.price >= f.minPrice!);
    if (f.maxPrice != null) svc = svc.filter((s) => s.price <= f.maxPrice!);
    if ((sq || f.minPrice != null || f.maxPrice != null) && !svc.length) continue;

    const posts = db.posts.filter((p) => p.businessId === b.id && visibleTo(db, p, viewer));
    if (f.tags.length && !f.tags.every((t) => posts.some((p) => p.tags.map(norm).includes(norm(t))))) continue;
    if (q) {
      const hay = [b.name, b.username, b.description, ...services.map((s) => s.name), ...pros.map((p) => p.name), ...posts.flatMap((p) => p.tags)].map(norm).join(" ");
      if (!hay.includes(q)) continue;
    }
    const rating = ratingOf(db, b.id);
    if (f.minRating && (rating.count === 0 || rating.avg < f.minRating)) continue;

    const city = db.cities.find((c) => c.id === b.cityId);
    const distanceKm = geo && city ? haversineKm(geo, city) : null;
    if (f.maxKm && (distanceKm == null || distanceKm > f.maxKm)) continue;

    let nextSlot: string | null = null;
    if (date) {
      for (const s of svc.slice(0, 5)) {
        const slots = getSlots(db, { businessId: b.id, serviceId: s.id, date, professionalId: f.professionalId }, now);
        if (slots.length) {
          nextSlot = slots[0].start;
          break;
        }
      }
      if (!nextSlot) continue;
    }

    const thumbs = (f.cityId ? posts.filter((p) => servesCity(db, p, f.cityId!)) : posts)
      .filter((p) => !f.professionalId || p.professionalId === f.professionalId)
      .sort((a, b2) => Date.parse(b2.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
      .slice(0, 3);
    out.push({ business: b, minPrice: svc.length ? Math.min(...svc.map((s) => s.price)) : null, rating, distanceKm, nextSlot, matchingPros: pros, thumbs });
  }
  return out.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || b.rating.avg - a.rating.avg);
}

/** Posts for the discovery grid, honoring the same city/category/professional filters. */
export function searchPosts(db: DB, viewer: User | null, f: DiscoverFilters, businessIds: Set<ID>) {
  const q = norm(f.q);
  return db.posts
    .filter((p) => visibleTo(db, p, viewer) && businessIds.has(p.businessId))
    .filter((p) => !f.cityId || servesCity(db, p, f.cityId))
    .filter((p) => !f.professionalId || p.professionalId === f.professionalId)
    .filter((p) => !f.tags.length || f.tags.every((t) => p.tags.map(norm).includes(norm(t))))
    .filter((p) => {
      if (!f.category) return true;
      const s = db.services.find((x) => x.id === p.serviceId);
      return s ? s.category === f.category : db.businesses.find((b) => b.id === p.businessId)?.categories.includes(f.category);
    })
    .filter((p) => !q || norm(p.caption + " " + p.tags.join(" ")).includes(q) || businessIds.has(p.businessId))
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
}

export function activeFilterCount(f: DiscoverFilters) {
  return (
    (f.cityId ? 1 : 0) +
    (f.maxKm ? 1 : 0) +
    (f.category ? 1 : 0) +
    (f.serviceQuery ? 1 : 0) +
    f.tags.length +
    (f.professionalId ? 1 : 0) +
    (f.minPrice != null || f.maxPrice != null ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.date ? 1 : 0) +
    (f.today ? 1 : 0)
  );
}

export function allTags(db: DB) {
  const counts = new Map<string, number>();
  for (const p of db.posts) if (p.status === "published") for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
