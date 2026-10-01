import { DateTime } from "luxon";
import { prisma, type Tx } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";

/**
 * Server-side availability.
 *
 * Inputs: staff working hours (minutes from local midnight per weekday),
 * recurring breaks, time off, existing slot-holding appointments, the service
 * duration + preparation buffer, and staff eligibility for the service.
 *
 * Wall-clock times are resolved in the business timezone with Luxon, so a
 * 09:00 shift stays 09:00 local across daylight-saving changes.
 */

export const HOLDING_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

type Interval = { start: number; end: number }; // epoch ms, [start, end)

export type SlotQuery = {
  businessId: string;
  serviceId: string;
  /** Local calendar date in the business timezone, YYYY-MM-DD */
  date: string;
  /** Restrict to one staff member; omit for "any qualified staff". */
  staffId?: string | null;
  /** Ignore this appointment when checking conflicts (rescheduling). */
  excludeAppointmentId?: string;
  /** Override service duration (consultation proposals). */
  durationMin?: number;
  /** Business-side manual booking may ignore the customer lead time. */
  ignoreLeadTime?: boolean;
  now?: Date;
};

export type Slot = { start: string; end: string; staffIds: string[] };

/** Luxon weekday (1=Mon..7=Sun) → 0=Sun..6=Sat */
export const weekdayIndex = (d: DateTime) => d.weekday % 7;

/** Wall-clock minute-of-day → instant on that local date (DST-safe). */
export function localMinuteToInstant(day: DateTime, minute: number) {
  if (minute >= 1440) return day.plus({ days: 1 }).startOf("day");
  return day.set({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0, millisecond: 0 });
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export async function getSlots(q: SlotQuery, db: Tx = prisma): Promise<Slot[]> {
  const business = await db.business.findUnique({
    where: { id: q.businessId },
    select: { id: true, timezone: true, slotStepMinutes: true, minLeadMinutes: true, maxAdvanceDays: true },
  });
  if (!business) throw notFound("העסק");
  const service = await db.service.findFirst({
    where: { id: q.serviceId, businessId: q.businessId, active: true },
    select: { id: true, durationMin: true, bufferMin: true },
  });
  if (!service) throw notFound("השירות");

  const zone = business.timezone;
  const day = DateTime.fromISO(q.date, { zone }).startOf("day");
  if (!day.isValid) throw badRequest("תאריך לא תקין");
  const dayEnd = day.plus({ days: 1 }).startOf("day");
  const wd = weekdayIndex(day);

  const now = DateTime.fromJSDate(q.now ?? new Date());
  const earliest = q.ignoreLeadTime ? now.toMillis() : now.plus({ minutes: business.minLeadMinutes }).toMillis();
  const latest = now.plus({ days: business.maxAdvanceDays }).toMillis();

  const staff = await db.staffMember.findMany({
    where: {
      businessId: q.businessId,
      active: true,
      services: { some: { serviceId: service.id } },
      ...(q.staffId ? { id: q.staffId } : {}),
    },
    select: {
      id: true,
      workingHours: { where: { weekday: wd } },
      breaks: { where: { weekday: wd } },
      timeOff: {
        where: { startsAt: { lt: dayEnd.toJSDate() }, endsAt: { gt: day.toJSDate() } },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
  if (staff.length === 0) return [];

  const appts = await db.appointment.findMany({
    where: {
      staffId: { in: staff.map((s) => s.id) },
      status: { in: [...HOLDING_STATUSES] },
      startsAt: { lt: dayEnd.toJSDate() },
      blockEndsAt: { gt: day.toJSDate() },
      ...(q.excludeAppointmentId ? { id: { not: q.excludeAppointmentId } } : {}),
    },
    select: { staffId: true, startsAt: true, blockEndsAt: true },
  });

  const duration = q.durationMin ?? service.durationMin;
  const blockLen = (duration + service.bufferMin) * 60_000;
  const step = business.slotStepMinutes * 60_000;

  const byStart = new Map<number, string[]>();

  for (const s of staff) {
    const busy: Interval[] = [
      ...s.breaks.map((b) => ({
        start: localMinuteToInstant(day, b.startMin).toMillis(),
        end: localMinuteToInstant(day, b.endMin).toMillis(),
      })),
      ...s.timeOff.map((t) => ({ start: t.startsAt.getTime(), end: t.endsAt.getTime() })),
      ...appts
        .filter((a) => a.staffId === s.id)
        .map((a) => ({ start: a.startsAt.getTime(), end: a.blockEndsAt.getTime() })),
    ];
    for (const w of s.workingHours) {
      const wStart = localMinuteToInstant(day, w.startMin).toMillis();
      const wEnd = localMinuteToInstant(day, w.endMin).toMillis();
      for (let t = wStart; t + blockLen <= wEnd; t += step) {
        if (t < earliest || t > latest) continue;
        const candidate = { start: t, end: t + blockLen };
        if (busy.some((b) => overlaps(candidate, b))) continue;
        const list = byStart.get(t) ?? [];
        list.push(s.id);
        byStart.set(t, list);
      }
    }
  }

  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, staffIds]) => ({
      start: new Date(t).toISOString(),
      end: new Date(t + duration * 60_000).toISOString(),
      staffIds,
    }));
}

/** Exact re-validation of a single start for a single staff member. */
export async function isSlotAvailable(
  args: Omit<SlotQuery, "date" | "staffId"> & { staffId: string; startsAt: Date },
  db: Tx = prisma,
) {
  const business = await db.business.findUnique({ where: { id: args.businessId }, select: { timezone: true } });
  if (!business) return false;
  const date = DateTime.fromJSDate(args.startsAt).setZone(business.timezone).toISODate()!;
  const slots = await getSlots({ ...args, date }, db);
  const iso = args.startsAt.toISOString();
  return slots.some((s) => s.start === iso && s.staffIds.includes(args.staffId));
}

/** Next available days for a service (used for date pickers and search). */
export async function nextAvailableDates(
  q: Omit<SlotQuery, "date">,
  days = 14,
  db: Tx = prisma,
) {
  const business = await db.business.findUnique({ where: { id: q.businessId }, select: { timezone: true } });
  if (!business) return [];
  const start = DateTime.fromJSDate(q.now ?? new Date()).setZone(business.timezone).startOf("day");
  const out: { date: string; count: number; first?: string }[] = [];
  for (let i = 0; i < days; i++) {
    const date = start.plus({ days: i }).toISODate()!;
    const slots = await getSlots({ ...q, date }, db);
    out.push({ date, count: slots.length, first: slots[0]?.start });
  }
  return out;
}
