import { DateTime } from "luxon";
import { BUSINESS_TZ } from "./constants";

export function formatPrice(agorot: number, opts: { from?: boolean } = {}) {
  const shekels = agorot / 100;
  const n = Number.isInteger(shekels) ? shekels.toString() : shekels.toFixed(2);
  return `${opts.from ? "החל מ־" : ""}₪${n}`;
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} דק׳`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שעות`;
  return m ? `${hours} ו־${m} דק׳` : hours;
}

export function dt(d: Date | string, zone = BUSINESS_TZ) {
  return (typeof d === "string" ? DateTime.fromISO(d) : DateTime.fromJSDate(d))
    .setZone(zone)
    .setLocale("he");
}

export function formatDate(d: Date | string, zone = BUSINESS_TZ) {
  return dt(d, zone).toFormat("cccc, d בLLLL");
}

export function formatTime(d: Date | string, zone = BUSINESS_TZ) {
  return dt(d, zone).toFormat("HH:mm");
}

export function formatDateTime(d: Date | string, zone = BUSINESS_TZ) {
  return `${formatDate(d, zone)} · ${formatTime(d, zone)}`;
}

export function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function relativeTime(d: Date | string) {
  return dt(d).toRelative({ locale: "he" }) ?? "";
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) return null;
  return `/media/${path}`;
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
