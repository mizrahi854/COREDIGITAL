import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/format";
import { requireOwnerPage } from "@/server/biz-context";
import { BizProfileForm } from "@/components/biz/profile-form";

export const metadata = { title: "פרופיל העסק" };

export default async function BizProfilePage() {
  const ctx = await requireOwnerPage();
  const b = ctx.business;
  const [hours, portfolio] = await Promise.all([
    prisma.openingHours.findMany({ where: { businessId: b.id }, orderBy: [{ weekday: "asc" }, { openMin: "asc" }] }),
    prisma.portfolioItem.findMany({ where: { businessId: b.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <BizProfileForm
      business={{
        slug: b.slug,
        name: b.name,
        tagline: b.tagline ?? "",
        description: b.description,
        categories: b.categories,
        city: b.city,
        address: b.address,
        phone: b.phone ?? "",
        instagram: b.instagram ?? "",
        lat: b.lat,
        lng: b.lng,
        cancellationHours: b.cancellationHours,
        cancellationPolicy: b.cancellationPolicy,
        coverUrl: mediaUrl(b.coverPath),
        avatarUrl: mediaUrl(b.avatarPath),
      }}
      hours={hours.map((h) => ({ weekday: h.weekday, openMin: h.openMin, closeMin: h.closeMin }))}
      portfolio={portfolio.map((p) => ({ id: p.id, url: mediaUrl(p.imagePath)!, caption: p.caption }))}
    />
  );
}
