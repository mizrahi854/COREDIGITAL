import { z } from "zod";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { api, limit, parseJson } from "@/server/http";
import { getUser } from "@/server/auth";
import { track } from "@/server/analytics";

const Body = z.object({
  type: z.enum(["REEL_VIEW", "PROFILE_VIEW", "BOOKING_START"]),
  businessId: z.string().min(1),
  reelId: z.string().nullable().optional(),
});

export const POST = api(async (req) => {
  await limit(req, "events", 240, 60);
  const b = await parseJson(req, Body);
  const jar = await cookies();
  let visitor = jar.get("buber_v")?.value;
  if (!visitor) {
    visitor = crypto.randomBytes(12).toString("hex");
    jar.set("buber_v", visitor, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const biz = await prisma.business.count({ where: { id: b.businessId } });
  if (!biz) return { ok: true };
  if (b.reelId) {
    const r = await prisma.reel.count({ where: { id: b.reelId, businessId: b.businessId } });
    if (!r) b.reelId = null;
  }
  const user = await getUser();
  await track({ type: b.type, businessId: b.businessId, reelId: b.reelId, userId: user?.id, visitorKey: visitor });
  return { ok: true };
});
