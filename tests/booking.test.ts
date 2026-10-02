import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { createSeed } from "../src/data/seed";
import * as booking from "../src/domain/booking";
import { TZ } from "../src/domain/time";
import type { DB } from "../src/domain/types";

const NOW = new Date("2026-10-04T06:00:00Z"); // Sunday 09:00 Jerusalem
const fresh = () => createSeed(NOW);
const dana = (db: DB) => db.users.find((u) => u.id === "u-dana")!;
const yoav = (db: DB) => db.users.find((u) => u.id === "u-yoav")!;
const nextDate = (days: number) => DateTime.fromJSDate(NOW).setZone(TZ).plus({ days }).toISODate()!;
const hhmm = (iso: string) => DateTime.fromISO(iso).setZone(TZ).toFormat("HH:mm");

describe("seed", () => {
  it("builds a coherent dataset", () => {
    const db = fresh();
    expect(db.businesses.filter((b) => b.status === "active")).toHaveLength(12);
    expect(new Set(db.businesses.map((b) => b.cityId)).size).toBeGreaterThanOrEqual(6);
    for (const b of db.businesses.filter((x) => x.status === "active")) expect(db.professionals.filter((p) => p.businessId === b.id).length).toBeGreaterThanOrEqual(2);
    const statuses = new Set(db.appointments.map((a) => a.status));
    for (const s of ["pending_approval", "pending_payment", "confirmed", "completed", "cancelled", "rejected", "no_show"]) expect(statuses).toContain(s);
    // reviews only for completed appointments
    for (const r of db.reviews) expect(db.appointments.find((a) => a.id === r.appointmentId)?.status).toBe("completed");
  });

  it("seeded appointments never overlap for a professional", () => {
    const db = fresh();
    const holding = db.appointments.filter((a) => booking.holdsSlot(a, NOW));
    for (const a of holding)
      for (const b of holding)
        if (a !== b && a.professionalId === b.professionalId)
          expect(Date.parse(a.start) < Date.parse(b.end) + b.snapshot.bufferMin * 60000 && Date.parse(b.start) < Date.parse(a.end) + a.snapshot.bufferMin * 60000).toBe(false);
  });
});

describe("availability", () => {
  it("respects working hours, duration + buffer and breaks", () => {
    const db = fresh();
    db.appointments = [];
    // Nova, תספורת נשים (60 + 10), מאיה 09:00–19:00, break 13:00–13:30
    const slots = booking.getSlots(db, { businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", date: nextDate(1) }, NOW);
    const t = slots.map((s) => hhmm(s.start));
    expect(t[0]).toBe("09:00");
    expect(t.at(-1)).toBe("17:45");
    expect(t).not.toContain("12:00"); // 12:00–13:10 crosses the break
    expect(t).toContain("11:45");
    expect(t).toContain("13:30");
  });

  it("selecting a professional changes the offered services and slots", () => {
    const db = fresh();
    // דניאל (p1) does not perform תספורת נשים (s0)
    expect(booking.getSlots(db, { businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p1", date: nextDate(1) }, NOW)).toEqual([]);
    const any = booking.getSlots(db, { businessId: "b-nova", serviceId: "b-nova-s0", date: nextDate(1) }, NOW);
    expect(any.every((s) => !s.professionalIds.includes("b-nova-p1"))).toBe(true);
  });

  it("blocked time removes availability", () => {
    const db = fresh();
    db.appointments = [];
    const day = DateTime.fromISO(nextDate(1), { zone: TZ });
    booking.addBlockedTime(db, { businessId: "b-nova", professionalId: "b-nova-p0", start: day.set({ hour: 9 }).toUTC().toISO()!, end: day.set({ hour: 12 }).toUTC().toISO()!, reason: "השתלמות" });
    const t = booking.getSlots(db, { businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", date: nextDate(1) }, NOW).map((s) => hhmm(s.start));
    expect(t.every((x) => x >= "12:00")).toBe(true);
  });
});

describe("booking", () => {
  const firstSlot = (db: DB, serviceId: string, pro?: string, days = 1) =>
    booking.getSlots(db, { businessId: serviceId.split("-s")[0], serviceId, professionalId: pro, date: nextDate(days) }, NOW)[0];

  it("fixed-price service at the business is confirmed immediately and snapshots the agreement", () => {
    const db = fresh();
    const slot = firstSlot(db, "b-nova-s0", "b-nova-p0");
    const a = booking.createBooking(db, { customer: dana(db), businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slot.start, inspirationPostIds: ["b-nova-post1"], sourcePostId: "b-nova-post1" }, NOW);
    expect(a.status).toBe("confirmed");
    expect(a.snapshot.price).toBe(220);
    db.services.find((s) => s.id === "b-nova-s0")!.price = 999;
    db.services.find((s) => s.id === "b-nova-s0")!.durationMin = 120;
    expect(db.appointments.find((x) => x.id === a.id)!.snapshot.price).toBe(220);
    expect(Date.parse(a.end) - Date.parse(a.start)).toBe(60 * 60000);
  });

  it("prevents double booking of the same slot", () => {
    const db = fresh();
    const slot = firstSlot(db, "b-nova-s0", "b-nova-p0");
    booking.createBooking(db, { customer: dana(db), businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slot.start, inspirationPostIds: [] }, NOW);
    expect(() => booking.createBooking(db, { customer: yoav(db), businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slot.start, inspirationPostIds: [] }, NOW)).toThrow(/לא פנוי/);
  });

  it("manual approval holds the slot until it expires, then releases it", () => {
    const db = fresh();
    const slot = firstSlot(db, "b-chrome-s1", "b-chrome-p0", 2);
    const a = booking.createBooking(db, { customer: dana(db), businessId: "b-chrome", serviceId: "b-chrome-s1", professionalId: "b-chrome-p0", start: slot.start, inspirationPostIds: [] }, NOW);
    expect(a.status).toBe("pending_approval");
    expect(booking.isSlotFree(db, { businessId: "b-chrome", serviceId: "b-chrome-s1", professionalId: "b-chrome-p0", start: slot.start }, NOW)).toBe(false);
    const later = new Date(NOW.getTime() + 25 * 3600_000);
    booking.expireHolds(db, later);
    expect(a.status).toBe("cancelled");
    expect(a.cancelledBy).toBe("system");
  });

  it("deposit flow: pending payment → failed payment keeps it pending → success confirms", () => {
    const db = fresh();
    const slot = firstSlot(db, "b-atelier-s2", "b-atelier-p0", 3);
    const a = booking.createBooking(db, { customer: dana(db), businessId: "b-atelier", serviceId: "b-atelier-s2", professionalId: "b-atelier-p0", start: slot.start, inspirationPostIds: [] }, NOW);
    expect(a.status).toBe("pending_payment");
    expect(a.snapshot.deposit).toBe(50);
    booking.payDeposit(db, a.id, "u-dana", "failure", NOW);
    expect(a.status).toBe("pending_payment");
    expect(a.payment.status).toBe("failed_demo");
    booking.payDeposit(db, a.id, "u-dana", "success", NOW);
    expect(a.status).toBe("confirmed");
  });

  it("manual approval + deposit: approve → pending payment", () => {
    const db = fresh();
    const slot = firstSlot(db, "b-nova-s3", "b-nova-p0", 8);
    const a = booking.createBooking(db, { customer: dana(db), businessId: "b-nova", serviceId: "b-nova-s3", professionalId: "b-nova-p0", start: slot.start, inspirationPostIds: [] }, NOW);
    expect(a.status).toBe("pending_approval");
    booking.approve(db, a.id, "u-owner-nova", NOW);
    expect(a.status).toBe("pending_payment");
    expect(a.snapshot.deposit).toBe(285);
  });

  it("cancellation releases the slot", () => {
    const db = fresh();
    const slot = firstSlot(db, "b-nova-s0", "b-nova-p0");
    const a = booking.createBooking(db, { customer: dana(db), businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slot.start, inspirationPostIds: [] }, NOW);
    booking.cancel(db, a.id, { id: "u-dana", kind: "customer" }, "");
    expect(booking.isSlotFree(db, { businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slot.start }, NOW)).toBe(true);
  });

  it("rescheduling is atomic: a taken target leaves the original untouched", () => {
    const db = fresh();
    const slots = booking.getSlots(db, { businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", date: nextDate(1) }, NOW);
    const mine = booking.createBooking(db, { customer: dana(db), businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slots[0].start, inspirationPostIds: [] }, NOW);
    const other = booking.createBooking(db, { customer: yoav(db), businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slots[8].start, inspirationPostIds: [] }, NOW);
    expect(() => booking.reschedule(db, mine.id, { id: "u-dana", kind: "customer" }, { start: other.start }, NOW)).toThrow();
    expect(mine.start).toBe(slots[0].start);
    booking.reschedule(db, mine.id, { id: "u-dana", kind: "customer" }, { start: slots[1].start }, NOW);
    expect(mine.start).toBe(slots[1].start);
  });

  it("customers cannot cancel someone else's appointment", () => {
    const db = fresh();
    const slot = firstSlot(db, "b-nova-s0", "b-nova-p0");
    const a = booking.createBooking(db, { customer: dana(db), businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slot.start, inspirationPostIds: [] }, NOW);
    expect(() => booking.cancel(db, a.id, { id: "u-yoav", kind: "customer" }, "")).toThrow(/אין גישה/);
  });

  it("only customers can book", () => {
    const db = fresh();
    const owner = db.users.find((u) => u.id === "u-owner-nova")!;
    const slot = firstSlot(db, "b-nova-s0", "b-nova-p0");
    expect(() => booking.createBooking(db, { customer: owner, businessId: "b-nova", serviceId: "b-nova-s0", professionalId: "b-nova-p0", start: slot.start, inspirationPostIds: [] }, NOW)).toThrow();
  });
});
