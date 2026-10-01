import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";

type Ctx = { params: Promise<{ id: string }> };

async function own(id: string, userId: string) {
  const c = await prisma.collection.findFirst({ where: { id, userId } });
  if (!c) throw notFound("האוסף");
  return c;
}

export const PATCH = api<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await own(id, user.id);
  const b = await parseJson(req, z.object({ name: z.string().trim().min(1).max(40) }));
  await prisma.collection.update({ where: { id }, data: { name: b.name } });
  return { ok: true };
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await own(id, user.id);
  await prisma.collection.delete({ where: { id } });
  return { ok: true };
});
