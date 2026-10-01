import { prisma } from "@/lib/db";
import { requireOwnerPage } from "@/server/biz-context";
import { ServicesManager } from "@/components/biz/services-manager";

export const metadata = { title: "שירותים" };

export default async function ServicesPage() {
  const ctx = await requireOwnerPage();
  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { businessId: ctx.business.id }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }], include: { staff: { select: { staffId: true } } } }),
    prisma.staffMember.findMany({ where: { businessId: ctx.business.id, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <ServicesManager
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        styleTags: s.styleTags,
        mode: s.mode,
        priceAgorot: s.priceAgorot,
        durationMin: s.durationMin,
        bufferMin: s.bufferMin,
        active: s.active,
        staffIds: s.staff.map((x) => x.staffId),
      }))}
      staff={staff}
      defaultCategory={ctx.business.categories[0] ?? "NAILS"}
    />
  );
}
