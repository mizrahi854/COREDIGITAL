import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { api, limit, parseJson } from "@/server/http";
import { createSession, verifyPassword } from "@/server/auth";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("כתובת אימייל לא תקינה"),
  password: z.string().min(1, "נא להזין סיסמה"),
});

export const POST = api(async (req) => {
  const b = await parseJson(req, Body);
  await limit(req, "login", 10, 600, b.email);
  const user = await prisma.user.findUnique({ where: { email: b.email } });
  if (!user || !(await verifyPassword(b.password, user.passwordHash))) {
    throw new AppError(401, "bad_credentials", "האימייל או הסיסמה שגויים");
  }
  await createSession(user.id);
  return { ok: true, onboarded: !!user.onboardedAt };
});
