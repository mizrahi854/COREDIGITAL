import { DateTime } from "luxon";

/** All business logic runs in the demo region's timezone, independent of the device timezone. */
export const TZ = "Asia/Jerusalem";

export const nowISO = () => new Date().toISOString();

export function local(iso: string | Date) {
  return (typeof iso === "string" ? DateTime.fromISO(iso) : DateTime.fromJSDate(iso)).setZone(TZ).setLocale("he");
}

export function dayStart(date: string) {
  return DateTime.fromISO(date, { zone: TZ }).startOf("day");
}

/** Wall-clock minute-of-day on a local date → instant (DST-safe). */
export function atMinute(day: DateTime, minute: number) {
  if (minute >= 1440) return day.plus({ days: 1 }).startOf("day");
  return day.set({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0, millisecond: 0 });
}

export const weekday = (d: DateTime) => d.weekday % 7; // 0 = Sunday

export const todayISODate = (now = new Date()) => DateTime.fromJSDate(now).setZone(TZ).toISODate()!;

export function fmtDate(iso: string) {
  return local(iso).toFormat("cccc, d בLLLL");
}
export function fmtShortDate(iso: string) {
  return local(iso).toFormat("ccc d/M");
}
export function fmtTime(iso: string) {
  return local(iso).toFormat("HH:mm");
}
export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}
export function fmtRelative(iso: string) {
  return local(iso).toRelative({ locale: "he" }) ?? "";
}
export function minToHHMM(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
export function hhmmToMin(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;
