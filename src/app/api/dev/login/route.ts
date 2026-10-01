import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { createSession, devLoginEnabled } from "@/server/auth";

const Body = z.object({ email: z.string().email() });

/** Development-only one-click login for the seeded role accounts. Disabled in production builds. */
export const POST = api(async (req) => {
  if (!devLoginEnabled()) throw notFound("הנתיב");
  const { email } = await parseJson(req, Body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw notFound("המשתמש");
  await createSession(user.id);
  return { ok: true };
});
