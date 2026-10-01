import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getSlots } from "@/server/availability";
import { acceptProposal, cancelAppointment, createBooking, proposeForRequest, rescheduleAppointment } from "@/server/booking";
import { at, business, nextWorkday, resetDb, user } from "../support/fixtures";

const key = () => Math.random().toString(36).slice(2) + Date.now();

async function errCode(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
}

describe("booking integrity", () => {
  beforeEach(resetDb);

  it("two simultaneous requests for the same staff slot: exactly one succeeds", async () => {
    const f = await business();
    const day = nextWorkday();
    const customers = await Promise.all(Array.from({ length: 8 }, () => user()));
    const results = await Promise.allSettled(
      customers.map((c) =>
        createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "10:00"), idempotencyKey: key() }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed.every((r) => (r.reason as AppError).code === "slot_unavailable")).toBe(true);
    expect(await prisma.appointment.count({ where: { status: "CONFIRMED" } })).toBe(1);
  });

  it("overlapping (not identical) slots on the same staff also conflict", async () => {
    const f = await business();
    const day = nextWorkday();
    const [a, b] = await Promise.all([user(), user()]);
    const r = await Promise.allSettled([
      createBooking({ customerId: a.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "10:00"), idempotencyKey: key() }),
      createBooking({ customerId: b.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "10:45"), idempotencyKey: key() }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("'any staff' spreads simultaneous requests across qualified staff, then refuses", async () => {
    const f = await business({ staffCount: 2 });
    const day = nextWorkday();
    const cs = await Promise.all([user(), user(), user()]);
    const r = await Promise.allSettled(
      cs.map((c) => createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: null, startsAt: at(day, "11:00"), idempotencyKey: key() })),
    );
    const ok = r.filter((x) => x.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof createBooking>>>[];
    expect(ok).toHaveLength(2);
    expect(new Set(ok.map((x) => x.value.appointment.staffId)).size).toBe(2);
  });

  it("the database itself rejects overlapping confirmed appointments", async () => {
    const f = await business();
    const day = nextWorkday();
    const base = {
      businessId: f.business.id, staffId: f.staff[0].id, serviceId: f.fixed.id, status: "CONFIRMED" as const,
      serviceName: "x", priceAgorot: 1, priceIsFinal: true, durationMin: 60, bufferMin: 15, cancellationHours: 24, cancellationPolicy: "",
    };
    const s1 = new Date(at(day, "10:00"));
    await prisma.appointment.create({ data: { ...base, startsAt: s1, endsAt: new Date(+s1 + 3600e3), blockEndsAt: new Date(+s1 + 4500e3) } });
    const s2 = new Date(at(day, "11:00")); // inside the first one's buffer
    await expect(prisma.appointment.create({ data: { ...base, startsAt: s2, endsAt: new Date(+s2 + 3600e3), blockEndsAt: new Date(+s2 + 4500e3) } })).rejects.toThrow(/no_staff_overlap|23P01/);
  });

  it("repeated submissions with the same idempotency key create one appointment", async () => {
    const f = await business();
    const c = await user();
    const k = key();
    const input = { customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(nextWorkday(), "09:00"), idempotencyKey: k };
    const [a, b] = await Promise.all([createBooking(input), createBooking(input)]);
    const third = await createBooking(input);
    expect(a.appointment.id).toBe(b.appointment.id);
    expect(third.appointment.id).toBe(a.appointment.id);
    expect(third.replayed).toBe(true);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("revalidates availability at confirmation (stale slot is refused)", async () => {
    const f = await business();
    const day = nextWorkday();
    await prisma.timeOff.create({ data: { staffId: f.staff[0].id, startsAt: new Date(at(day, "09:00")), endsAt: new Date(at(day, "12:00")) } });
    const c = await user();
    expect(await errCode(createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "10:00"), idempotencyKey: key() }))).toBe("slot_unavailable");
    // an off-grid time is never accepted either
    expect(await errCode(createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "14:07"), idempotencyKey: key() }))).toBe("slot_unavailable");
  });

  it("cancellation releases the slot", async () => {
    const f = await business();
    const day = nextWorkday();
    const [a, b] = await Promise.all([user(), user()]);
    const first = await createBooking({ customerId: a.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "09:00"), idempotencyKey: key() });
    expect(await errCode(createBooking({ customerId: b.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "09:00"), idempotencyKey: key() }))).toBe("slot_unavailable");
    await cancelAppointment(first.appointment.id, { kind: "customer", userId: a.id });
    const slots = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: day.toISODate()! });
    expect(slots[0].start).toBe(at(day, "09:00").replace(/\.\d+Z$/, ".000Z"));
    const second = await createBooking({ customerId: b.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "09:00"), idempotencyKey: key() });
    expect(second.appointment.status).toBe("CONFIRMED");
  });

  it("customers cannot cancel or reschedule inside the policy window; business can", async () => {
    const f = await business();
    const c = await user();
    const soon = new Date(Date.now() + 3 * 3600e3);
    const s = await prisma.appointment.create({
      data: {
        businessId: f.business.id, customerId: c.id, staffId: f.staff[0].id, serviceId: f.fixed.id, status: "CONFIRMED",
        startsAt: soon, endsAt: new Date(+soon + 3600e3), blockEndsAt: new Date(+soon + 4500e3),
        serviceName: "x", priceAgorot: 1, priceIsFinal: true, durationMin: 60, bufferMin: 15, cancellationHours: 24, cancellationPolicy: "",
      },
    });
    expect(await errCode(cancelAppointment(s.id, { kind: "customer", userId: c.id }))).toBe("policy_window");
    expect(await errCode(rescheduleAppointment(s.id, { kind: "customer", userId: c.id }, { startsAt: at(nextWorkday(), "09:00") }))).toBe("policy_window");
    const done = await cancelAppointment(s.id, { kind: "business", userId: f.owner.id });
    expect(done.status).toBe("CANCELLED");
  });

  it("another customer cannot touch someone else's appointment", async () => {
    const f = await business();
    const [a, b] = await Promise.all([user(), user()]);
    const { appointment } = await createBooking({ customerId: a.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(nextWorkday(), "09:00"), idempotencyKey: key() });
    expect(await errCode(cancelAppointment(appointment.id, { kind: "customer", userId: b.id }))).toBe("not_found");
    expect(await errCode(rescheduleAppointment(appointment.id, { kind: "customer", userId: b.id }, { startsAt: at(nextWorkday(), "11:00") }))).toBe("not_found");
  });

  it("rescheduling is atomic: a taken target leaves the original untouched", async () => {
    const f = await business();
    const day = nextWorkday();
    const [a, b] = await Promise.all([user(), user()]);
    const mine = await createBooking({ customerId: a.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "09:00"), idempotencyKey: key() });
    await createBooking({ customerId: b.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "14:00"), idempotencyKey: key() });

    expect(await errCode(rescheduleAppointment(mine.appointment.id, { kind: "customer", userId: a.id }, { startsAt: at(day, "14:00") }))).toBe("slot_unavailable");
    const unchanged = await prisma.appointment.findUniqueOrThrow({ where: { id: mine.appointment.id } });
    expect(unchanged.status).toBe("CONFIRMED");
    expect(unchanged.startsAt.toISOString()).toBe(mine.appointment.startsAt.toISOString());

    // moving into a slot that overlaps only its own current time is allowed (it is excluded from the check)
    const moved = await rescheduleAppointment(mine.appointment.id, { kind: "customer", userId: a.id }, { startsAt: at(day, "09:30") });
    expect(moved.startsAt.toISOString()).toBe(new Date(at(day, "09:30")).toISOString());
    // old time is free again for someone else
    const c = await user();
    const later = await createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "11:00"), idempotencyKey: key() });
    expect(later.appointment.status).toBe("CONFIRMED");
    expect(await prisma.appointmentEvent.count({ where: { appointmentId: mine.appointment.id, type: "rescheduled" } })).toBe(1);
  });

  it("service edits do not change existing appointment agreements", async () => {
    const f = await business();
    const c = await user();
    const { appointment } = await createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(nextWorkday(), "09:00"), idempotencyKey: key() });
    await prisma.service.update({ where: { id: f.fixed.id }, data: { priceAgorot: 99900, durationMin: 120, bufferMin: 30, name: "שם חדש" } });
    await prisma.business.update({ where: { id: f.business.id }, data: { cancellationHours: 72, cancellationPolicy: "חדש" } });
    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(after.priceAgorot).toBe(15000);
    expect(after.durationMin).toBe(60);
    expect(after.bufferMin).toBe(15);
    expect(after.serviceName).toBe("מניקור");
    expect(after.cancellationHours).toBe(24);
    expect(after.endsAt.getTime() - after.startsAt.getTime()).toBe(60 * 60_000);
    // rescheduling keeps the agreed duration, not the new service duration
    const moved = await rescheduleAppointment(appointment.id, { kind: "customer", userId: c.id }, { startsAt: at(nextWorkday(), "10:00") });
    expect(moved.endsAt.getTime() - moved.startsAt.getTime()).toBe(60 * 60_000);
    expect(moved.priceAgorot).toBe(15000);
  });

  it("consultation: pending until the customer accepts a business proposal", async () => {
    const f = await business();
    const day = nextWorkday();
    const c = await user();
    const { appointment: req } = await createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.consult.id, staffId: f.staff[0].id, startsAt: at(day, "09:00"), idempotencyKey: key() });
    expect(req.status).toBe("REQUESTED");
    expect(req.priceIsFinal).toBe(false);

    const p = await proposeForRequest(req.id, f.owner.id, f.business.id, { startsAt: at(day, "14:00"), priceAgorot: 26000, durationMin: 120, staffId: f.staff[0].id });
    expect(p.status).toBe("PROPOSED");

    // someone books the proposed time before acceptance → acceptance refused, request reopens
    const other = await user();
    await createBooking({ customerId: other.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(day, "14:00"), idempotencyKey: key() });
    expect(await errCode(acceptProposal(req.id, c.id))).toBe("slot_unavailable");
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("REQUESTED");

    await proposeForRequest(req.id, f.owner.id, f.business.id, { startsAt: at(day, "09:00"), priceAgorot: 26000, durationMin: 120, staffId: f.staff[0].id });
    const ok = await acceptProposal(req.id, c.id);
    expect(ok.status).toBe("CONFIRMED");
    expect(ok.priceAgorot).toBe(26000);
    expect(ok.priceIsFinal).toBe(true);
    expect(ok.endsAt.getTime() - ok.startsAt.getTime()).toBe(120 * 60_000);
  });

  it("creates confirmation + reminder records and cancels the reminder on cancellation", async () => {
    const f = await business();
    const c = await user();
    const { appointment } = await createBooking({ customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[0].id, startsAt: at(nextWorkday(3), "09:00"), idempotencyKey: key() });
    const n = await prisma.notification.findMany({ where: { appointmentId: appointment.id } });
    expect(n.map((x) => x.template).sort()).toEqual(["booking_confirmed", "reminder_24h"]);
    const reminder = n.find((x) => x.template === "reminder_24h")!;
    expect(appointment.startsAt.getTime() - reminder.scheduledFor.getTime()).toBe(24 * 3600e3);
    await cancelAppointment(appointment.id, { kind: "customer", userId: c.id });
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe("CANCELLED");
  });

  it("booking from a reel records the source and keeps it as inspiration", async () => {
    const f = await business();
    const c = await user();
    const reel = await prisma.reel.create({ data: { businessId: f.business.id, category: "NAILS", status: "PUBLISHED", videoPath: "x.mp4", serviceId: f.fixed.id, publishedAt: new Date() } });
    const { appointment } = await createBooking({
      customerId: c.id, businessId: f.business.id, serviceId: f.fixed.id, startsAt: at(nextWorkday(), "09:00"),
      idempotencyKey: key(), sourceReelId: reel.id, inspirationReelIds: [reel.id],
    });
    expect(appointment.source).toBe("REEL");
    expect(appointment.sourceReelId).toBe(reel.id);
    expect(await prisma.appointmentInspiration.count({ where: { appointmentId: appointment.id, reelId: reel.id } })).toBe(1);
  });
});
