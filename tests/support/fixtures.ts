import { DateTime } from "luxon";
import { prisma } from "@/lib/db";

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

let n = 0;
export async function user(name = "לקוח") {
  n++;
  return prisma.user.create({ data: { email: `u${n}-${Date.now()}@test.dev`, name, passwordHash: "x" } });
}

/**
 * A business with one or two staff working Sun–Fri 09:00–17:00 (break 13:00–13:30),
 * a fixed 60-min service with a 15-min buffer and a consultation service.
 */
export async function business(opts: { staffCount?: number } = {}) {
  const owner = await user("בעלים");
  n++;
  const b = await prisma.business.create({
    data: {
      slug: `biz-${n}-${Date.now()}`,
      name: `עסק ${n}`,
      categories: ["NAILS"],
      city: "תל אביב-יפו",
      status: "APPROVED",
      minLeadMinutes: 0,
      cancellationHours: 24,
      members: { create: { userId: owner.id, role: "OWNER" } },
    },
  });
  const staff = [];
  for (let i = 0; i < (opts.staffCount ?? 1); i++) {
    staff.push(
      await prisma.staffMember.create({
        data: {
          businessId: b.id,
          name: `צוות ${i}`,
          sortOrder: i,
          workingHours: { create: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 540, endMin: 1020 })) },
          breaks: { create: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 780, endMin: 810 })) },
        },
      }),
    );
  }
  const fixed = await prisma.service.create({
    data: {
      businessId: b.id,
      name: "מניקור",
      category: "NAILS",
      priceAgorot: 15000,
      durationMin: 60,
      bufferMin: 15,
      staff: { create: staff.map((s) => ({ staffId: s.id })) },
    },
  });
  const consult = await prisma.service.create({
    data: {
      businessId: b.id,
      name: "עיצוב מיוחד",
      category: "NAILS",
      mode: "CONSULTATION",
      priceAgorot: 20000,
      durationMin: 90,
      staff: { create: staff.map((s) => ({ staffId: s.id })) },
    },
  });
  return { business: b, owner, staff, fixed, consult };
}

/** Next date (YYYY-MM-DD, Jerusalem) that is a working weekday, at least `minDays` ahead. */
export function nextWorkday(minDays = 3) {
  let d = DateTime.now().setZone("Asia/Jerusalem").startOf("day").plus({ days: minDays });
  while (d.weekday === 6) d = d.plus({ days: 1 }); // Saturday off
  return d;
}

export const at = (day: DateTime, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return day.set({ hour: h, minute: m }).toUTC().toISO()!;
};
