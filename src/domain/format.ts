import type { CategoryId } from "./types";

export const CATEGORIES: { id: CategoryId; label: string; short: string }[] = [
  { id: "barber", label: "ברברים", short: "ברבר" },
  { id: "hair", label: "מספרות", short: "שיער" },
  { id: "stylist", label: "מעצבי שיער", short: "עיצוב שיער" },
  { id: "blowdry", label: "פן ועיצוב", short: "פן" },
  { id: "nails", label: "ציפורניים", short: "ציפורניים" },
  { id: "makeup", label: "איפור", short: "איפור" },
  { id: "brows", label: "גבות וריסים", short: "גבות וריסים" },
  { id: "skincare", label: "טיפוח עור", short: "טיפוח" },
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.short])) as Record<CategoryId, string>;

const ils = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });

export function price(n: number, from = false) {
  return `${from ? "החל מ־" : ""}${ils.format(n)}`;
}

export function duration(min: number) {
  if (min < 60) return `${min} דק׳`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שעות`;
  return m ? `${hours} ו־${m} דק׳` : hours;
}

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const STATUS_LABEL = {
  pending_approval: "ממתין לאישור העסק",
  pending_payment: "ממתין לתשלום מקדמה",
  confirmed: "מאושר",
  completed: "הושלם",
  cancelled: "בוטל",
  rejected: "נדחה",
  no_show: "לא הגיע/ה",
} as const;

export const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
