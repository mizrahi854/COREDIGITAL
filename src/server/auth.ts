import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/errors";

export const SESSION_COOKIE = "buber_session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  // Start in business mode when the user only exists to manage a business.
  const membership = await prisma.businessMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  await prisma.session.create({
    data: { id: sha256(token), userId, expiresAt, businessId: membership?.businessId ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: {
      user: {
        include: {
          memberships: { include: { business: { select: { id: true, name: true, slug: true, status: true } } } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
});

export type SessionWithUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export async function getUser() {
  return (await getSession())?.user ?? null;
}

export async function requireUser() {
  const s = await getSession();
  if (!s) throw unauthorized();
  return s.user;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (!u.isAdmin) throw forbidden();
  return u;
}

export async function setMode(mode: "customer" | "business", businessId?: string) {
  const s = await getSession();
  if (!s) throw unauthorized();
  if (mode === "business") {
    const target = businessId ?? s.businessId ?? s.user.memberships[0]?.businessId;
    if (!target || !s.user.memberships.some((m) => m.businessId === target)) throw forbidden();
    await prisma.session.update({ where: { id: s.id }, data: { mode, businessId: target } });
  } else {
    await prisma.session.update({ where: { id: s.id }, data: { mode } });
  }
}

export function devLoginEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true";
}
