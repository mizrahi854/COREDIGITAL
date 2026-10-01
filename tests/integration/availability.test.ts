import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getSlots } from "@/server/availability";
import { at, business, nextWorkday, resetDb, user } from "../support/fixtures";

const hhmm = (iso: string) => DateTime.fromISO(iso).setZone("Asia/Jerusalem").toFormat("HH:mm");

describe("availability", () => {
  beforeEach(resetDb);

  it("respects working hours, duration + buffer and breaks", async () => {
    const f = await business();
    const day = nextWorkday();
    const slots = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: day.toISODate()! });
    const times = slots.map((s) => hhmm(s.start));
    expect(times[0]).toBe("09:00");
    // 60 min + 15 min buffer must end by 17:00
    expect(times.at(-1)).toBe("15:45");
    // break 13:00–13:30: 11:45 ends exactly at 13:00 (ok), 12:00..13:15 overlap the break
    expect(times).toContain("11:45");
    for (const t of ["12:00", "12:15", "12:30", "12:45", "13:00", "13:15"]) expect(times).not.toContain(t);
    expect(times).toContain("13:30");
  });

  it("blocks existing appointments including their buffer, and time off", async () => {
    const f = await business();
    const day = nextWorkday();
    const start = new Date(at(day, "10:00"));
    await prisma.appointment.create({
      data: {
        businessId: f.business.id,
        staffId: f.staff[0].id,
        serviceId: f.fixed.id,
        status: "CONFIRMED",
        startsAt: start,
        endsAt: new Date(start.getTime() + 60 * 60_000),
        blockEndsAt: new Date(start.getTime() + 75 * 60_000),
        serviceName: "x",
        priceAgorot: 1,
        priceIsFinal: true,
        durationMin: 60,
        bufferMin: 15,
        cancellationHours: 24,
        cancellationPolicy: "",
      },
    });
    await prisma.timeOff.create({ data: { staffId: f.staff[0].id, startsAt: new Date(at(day, "14:00")), endsAt: new Date(at(day, "17:00")) } });
    const times = (await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: day.toISODate()! })).map((s) => hhmm(s.start));
    // 08:45 would end 10:00 but shift starts 09:00; 09:00 → 10:15 overlaps the booking
    expect(times).not.toContain("09:00");
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("11:00"); // booking holds staff until 11:15
    expect(times).toContain("11:15");
    expect(times.every((t) => t < "14:00")).toBe(true);
    expect(times.at(-1)).toBe("11:45"); // afternoon removed by time off and break
  });

  it("only offers staff qualified for the service", async () => {
    const f = await business({ staffCount: 2 });
    await prisma.staffService.deleteMany({ where: { staffId: f.staff[1].id } });
    const slots = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: nextWorkday().toISODate()! });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.staffIds.length === 1 && s.staffIds[0] === f.staff[0].id)).toBe(true);
    const none = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, staffId: f.staff[1].id, date: nextWorkday().toISODate()! });
    expect(none).toEqual([]);
  });

  it("does not offer past times or times inside the lead window", async () => {
    const f = await business();
    await prisma.business.update({ where: { id: f.business.id }, data: { minLeadMinutes: 60 } });
    const day = nextWorkday();
    const now = new Date(at(day, "10:05"));
    const times = (await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: day.toISODate()!, now })).map((s) => hhmm(s.start));
    // 10:05 + 60 min lead → first grid slot 11:15 (slots overlapping the 13:00 break are skipped)
    expect(times[0]).toBe("11:15");
    expect(times).not.toContain("12:15");
  });

  it("keeps wall-clock hours across daylight-saving changes (Asia/Jerusalem)", async () => {
    const f = await business();
    // Autumn 2026: IDT (UTC+3) → IST (UTC+2) on Sunday 25 Oct 02:00
    const nowAutumn = new Date("2026-10-15T08:00:00Z");
    const before = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: "2026-10-22", now: nowAutumn });
    const after = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: "2026-10-25", now: nowAutumn });
    expect(before[0].start).toBe("2026-10-22T06:00:00.000Z");
    expect(after[0].start).toBe("2026-10-25T07:00:00.000Z");
    // Spring 2026: IST → IDT on Friday 27 Mar
    const nowSpring = new Date("2026-03-20T08:00:00Z");
    const s1 = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: "2026-03-26", now: nowSpring });
    const s2 = await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: "2026-03-29", now: nowSpring });
    expect(s1[0].start).toBe("2026-03-26T07:00:00.000Z");
    expect(s2[0].start).toBe("2026-03-29T06:00:00.000Z");
    expect(hhmm(s2.at(-1)!.start)).toBe("15:45");
  });

  it("ignores consultation requests (they do not hold a slot)", async () => {
    const f = await business();
    const c = await user();
    const day = nextWorkday();
    const start = new Date(at(day, "09:00"));
    await prisma.appointment.create({
      data: {
        businessId: f.business.id, customerId: c.id, staffId: f.staff[0].id, serviceId: f.consult.id, status: "REQUESTED",
        startsAt: start, endsAt: new Date(start.getTime() + 90 * 60_000), blockEndsAt: new Date(start.getTime() + 90 * 60_000),
        serviceName: "x", priceAgorot: 1, priceIsFinal: false, durationMin: 90, bufferMin: 0, cancellationHours: 24, cancellationPolicy: "",
      },
    });
    const times = (await getSlots({ businessId: f.business.id, serviceId: f.fixed.id, date: day.toISODate()! })).map((s) => hhmm(s.start));
    expect(times[0]).toBe("09:00");
  });
});
