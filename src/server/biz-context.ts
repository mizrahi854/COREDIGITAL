import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "./auth";

/** Page-level guard for the dashboard: redirects instead of throwing. */
export const getBizContext = cache(async () => {
  const s = await getSession();
  if (!s) redirect("/login?next=/biz");
  const businessId = s.businessId ?? s.user.memberships[0]?.businessId;
  const member = s.user.memberships.find((m) => m.businessId === businessId);
  if (!member) redirect("/biz/new");
  const business = await prisma.business.findUniqueOrThrow({ where: { id: member.businessId } });
  const staff = await prisma.staffMember.findFirst({ where: { businessId: business.id, userId: s.userId }, select: { id: true } });
  return {
    user: s.user,
    business,
    role: member.role,
    staffId: staff?.id ?? null,
    memberships: s.user.memberships,
  };
});

export async function requireOwnerPage() {
  const ctx = await getBizContext();
  if (ctx.role !== "OWNER") redirect("/biz/calendar");
  return ctx;
}
