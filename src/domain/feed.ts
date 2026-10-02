import type { Business, CategoryId, DB, ID, Post, Service, User } from "./types";
import { haversineKm } from "./format";

/**
 * Inspectable demo ranking.
 * 1. Hard filters: visibility, business status, blocking, location/category.
 * 2. Score: relevance + freshness + saves + engagement (+ a labelled promotion boost).
 * 3. Diversity: at most 2 consecutive items from the same business.
 * Upload count is never a factor by itself; more posts only mean more candidates.
 */

export type FeedTab = "for_you" | "following" | "nearby";

export interface ScoreParts {
  relevance: number;
  freshness: number;
  saves: number;
  engagement: number;
  promoted: number;
  total: number;
  reasons: string[];
}

export interface RankedPost {
  post: Post;
  business: Business;
  service?: Service;
  score: ScoreParts;
  campaignId?: ID;
}

export function isPublic(db: DB, p: Post) {
  const b = db.businesses.find((x) => x.id === p.businessId);
  return p.status === "published" && !!b && b.status === "active";
}

/** A post serves a city if it was published for that city or the business/branch serves it. */
export function servesCity(db: DB, p: Post, cityId: ID) {
  if (p.cityId === cityId) return true;
  const b = db.businesses.find((x) => x.id === p.businessId);
  return !!b && (b.cityId === cityId || b.serviceAreaCityIds.includes(cityId));
}

export function businessServesCity(b: Business, cityId: ID) {
  return b.cityId === cityId || b.serviceAreaCityIds.includes(cityId);
}

export function visibleTo(db: DB, p: Post, viewer: User | null) {
  if (!isPublic(db, p)) return false;
  if (viewer?.blockedBusinessIds.includes(p.businessId)) return false;
  const owner = db.businesses.find((b) => b.id === p.businessId)?.ownerId;
  if (owner && viewer?.blockedUserIds.includes(owner)) return false;
  return true;
}

export function rankFeed(
  db: DB,
  viewer: User | null,
  opts: { tab: FeedTab; cityId?: ID | null; categories?: CategoryId[]; geo?: { lat: number; lng: number } | null; maxKm?: number },
  now = new Date(),
): RankedPost[] {
  const interests = new Set(viewer?.interests ?? []);
  const following = new Set(viewer?.followingBusinesses ?? []);
  const savedTags = new Set(
    db.collections
      .filter((c) => c.userId === viewer?.id)
      .flatMap((c) => c.postIds)
      .flatMap((id) => db.posts.find((p) => p.id === id)?.tags ?? []),
  );
  const activeCampaigns = db.campaigns.filter((c) => c.status === "active" && new Date(c.start) <= now && new Date(c.end) >= now);

  let candidates = db.posts.filter((p) => visibleTo(db, p, viewer));
  if (opts.tab === "following") candidates = candidates.filter((p) => following.has(p.businessId) || (viewer?.followingPros ?? []).includes(p.professionalId ?? ""));
  if (opts.cityId) candidates = candidates.filter((p) => servesCity(db, p, opts.cityId!));
  if (opts.tab === "nearby" && opts.geo && opts.maxKm) {
    candidates = candidates.filter((p) => {
      const b = db.businesses.find((x) => x.id === p.businessId)!;
      const city = db.cities.find((c) => c.id === b.cityId);
      return city ? haversineKm(opts.geo!, city) <= opts.maxKm! : false;
    });
  }
  if (opts.categories?.length) {
    candidates = candidates.filter((p) => {
      const b = db.businesses.find((x) => x.id === p.businessId)!;
      const svc = db.services.find((s) => s.id === p.serviceId);
      return opts.categories!.some((c) => svc?.category === c || b.categories.includes(c));
    });
  }

  const ranked = candidates.map((post): RankedPost => {
    const business = db.businesses.find((b) => b.id === post.businessId)!;
    const service = db.services.find((s) => s.id === post.serviceId && s.active);
    const reasons: string[] = [];
    let relevance = 0;
    const cat = service?.category ?? business.categories[0];
    if (interests.has(cat)) {
      relevance += 1;
      reasons.push("תואם לתחומי העניין שלך");
    }
    if (following.has(business.id)) {
      relevance += 1.2;
      reasons.push("עסק שאת/ה עוקב/ת אחריו");
    }
    const tagHits = post.tags.filter((t) => savedTags.has(t)).length;
    if (tagHits) {
      relevance += Math.min(1, tagHits * 0.4);
      reasons.push("דומה לעבודות ששמרת");
    }
    if (opts.cityId && servesCity(db, post, opts.cityId)) reasons.push("משרת את העיר שבחרת");
    const ageDays = (now.getTime() - new Date(post.publishedAt ?? post.createdAt).getTime()) / 86_400_000;
    const freshness = Math.pow(0.5, ageDays / 5);
    const saves = Math.log10(post.savedCount + 1) * 0.5;
    const engagement = Math.log10(post.likedBy.length + post.shares * 2 + 1) * 0.3 + Math.log10(post.views + 1) * 0.1;
    const campaign = activeCampaigns.find((c) => c.postId === post.id && (!opts.cityId || c.cityIds.includes(opts.cityId)));
    const promoted = campaign ? 0.8 : 0;
    if (campaign) reasons.unshift("ממומן");
    const total = relevance + freshness + saves + engagement + promoted;
    if (!reasons.length) reasons.push("חדש ופופולרי באזור");
    return { post, business, service, campaignId: campaign?.id, score: { relevance, freshness, saves, engagement, promoted, total, reasons } };
  });

  ranked.sort((a, b) => (opts.tab === "following" ? Date.parse(b.post.publishedAt ?? "") - Date.parse(a.post.publishedAt ?? "") : b.score.total - a.score.total));
  return diversify(ranked);
}

/** Avoid feed flooding: no more than 2 consecutive posts from one business. */
export function diversify(items: RankedPost[]) {
  const out: RankedPost[] = [];
  const rest = [...items];
  while (rest.length) {
    const lastTwo = out.slice(-2).map((x) => x.business.id);
    const blocked = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : null;
    const idx = rest.findIndex((x) => x.business.id !== blocked);
    out.push(...rest.splice(idx === -1 ? 0 : idx, 1));
  }
  return out;
}
