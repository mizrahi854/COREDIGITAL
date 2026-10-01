import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";

export const DELETE = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { id } = await params;
  const r = await prisma.portfolioItem.deleteMany({ where: { id, businessId: access.businessId } });
  if (!r.count) throw notFound();
  return { ok: true };
});
