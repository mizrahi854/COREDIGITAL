import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/format";
import { getSession } from "@/server/auth";
import { ProfileView } from "@/components/profile-view";

export const metadata: Metadata = { title: "פרופיל" };

export default async function ProfilePage() {
  const s = await getSession();
  if (!s) redirect("/login?next=/profile");
  const u = s.user;
  const [blocked, following] = await Promise.all([
    prisma.block.findMany({ where: { userId: u.id }, select: { business: { select: { id: true, name: true } } } }),
    prisma.follow.findMany({ where: { userId: u.id }, select: { business: { select: { id: true, name: true, slug: true, avatarPath: true } } } }),
  ]);
  return (
    <ProfileView
      user={{ name: u.name, email: u.email, phone: u.phone, city: u.city, lat: u.lat, lng: u.lng, interests: u.interests, isAdmin: u.isAdmin }}
      businesses={u.memberships.map((m) => ({ id: m.business.id, name: m.business.name, slug: m.business.slug, role: m.role, status: m.business.status }))}
      blocked={blocked.map((b) => b.business)}
      following={following.map((f) => ({ ...f.business, avatarUrl: mediaUrl(f.business.avatarPath) }))}
    />
  );
}
