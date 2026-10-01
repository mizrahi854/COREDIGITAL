import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/format";
import { requireOwnerPage } from "@/server/biz-context";
import { ReelsManager } from "@/components/biz/reels-manager";

export const metadata = { title: "רילס" };

export default async function ReelsPage() {
  const ctx = await requireOwnerPage();
  const [reels, services, staff] = await Promise.all([
    prisma.reel.findMany({
      where: { businessId: ctx.business.id },
      orderBy: { createdAt: "desc" },
      include: { service: { select: { name: true } }, _count: { select: { likes: true, saves: true, sourceOf: true } } },
    }),
    prisma.service.findMany({ where: { businessId: ctx.business.id, active: true }, select: { id: true, name: true, category: true } }),
    prisma.staffMember.findMany({ where: { businessId: ctx.business.id, active: true }, select: { id: true, name: true } }),
  ]);
  return (
    <ReelsManager
      defaultCategory={ctx.business.categories[0] ?? "NAILS"}
      services={services}
      staff={staff}
      reels={reels.map((r) => ({
        id: r.id,
        caption: r.caption,
        tags: r.tags,
        status: r.status,
        publishWhenReady: r.publishWhenReady,
        thumbUrl: mediaUrl(r.thumbPath),
        failureReason: r.failureReason,
        hiddenByAdmin: r.hiddenByAdmin,
        hiddenReason: r.hiddenReason,
        isSample: r.isSample,
        serviceId: r.serviceId,
        serviceName: r.service?.name ?? null,
        likes: r._count.likes,
        saves: r._count.saves,
        bookings: r._count.sourceOf,
      }))}
    />
  );
}
