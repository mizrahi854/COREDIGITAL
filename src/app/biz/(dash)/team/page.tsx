import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/format";
import { requireOwnerPage } from "@/server/biz-context";
import { TeamManager } from "@/components/biz/team-manager";

export const metadata = { title: "צוות ושעות" };

export default async function TeamPage() {
  const ctx = await requireOwnerPage();
  const [staff, services] = await Promise.all([
    prisma.staffMember.findMany({
      where: { businessId: ctx.business.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      include: {
        services: { select: { serviceId: true } },
        workingHours: { orderBy: [{ weekday: "asc" }, { startMin: "asc" }] },
        breaks: true,
        timeOff: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } },
        user: { select: { email: true } },
      },
    }),
    prisma.service.findMany({ where: { businessId: ctx.business.id, active: true }, select: { id: true, name: true } }),
  ]);
  return (
    <TeamManager
      timezone={ctx.business.timezone}
      services={services}
      staff={staff.map((s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        active: s.active,
        avatarUrl: mediaUrl(s.avatarPath),
        email: s.user?.email ?? null,
        serviceIds: s.services.map((x) => x.serviceId),
        workingHours: s.workingHours.map((w) => ({ weekday: w.weekday, startMin: w.startMin, endMin: w.endMin })),
        breaks: s.breaks.map((w) => ({ weekday: w.weekday, startMin: w.startMin, endMin: w.endMin, label: w.label })),
        timeOff: s.timeOff.map((t) => ({ id: t.id, startsAt: t.startsAt.toISOString(), endsAt: t.endsAt.toISOString(), reason: t.reason })),
      }))}
    />
  );
}
