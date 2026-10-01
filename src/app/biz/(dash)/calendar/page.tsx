import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getBizContext } from "@/server/biz-context";
import { CalendarView } from "@/components/biz/calendar-view";

export const metadata = { title: "יומן" };

export default async function CalendarPage() {
  const ctx = await getBizContext();
  const [staff, services] = await Promise.all([
    prisma.staffMember.findMany({
      where: { businessId: ctx.business.id, active: true, ...(ctx.role === "STAFF" ? { id: ctx.staffId ?? "-" } : {}) },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, workingHours: true },
    }),
    prisma.service.findMany({
      where: { businessId: ctx.business.id, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, durationMin: true, priceAgorot: true, staff: { select: { staffId: true } } },
    }),
  ]);
  return (
    <Suspense>
      <CalendarView
        timezone={ctx.business.timezone}
        role={ctx.role}
        staff={staff.map((s) => ({ id: s.id, name: s.name, hours: s.workingHours.map((h) => ({ weekday: h.weekday, startMin: h.startMin, endMin: h.endMin })) }))}
        services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceAgorot: s.priceAgorot, staffIds: s.staff.map((x) => x.staffId) }))}
      />
    </Suspense>
  );
}
