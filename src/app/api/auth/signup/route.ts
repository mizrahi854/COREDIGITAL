import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { api, limit, parseJson } from "@/server/http";
import { createSession, hashPassword } from "@/server/auth";

const Body = z.object({
  name: z.string().trim().min(2, "נא להזין שם מלא").max(60),
  email: z.string().trim().toLowerCase().email("כתובת אימייל לא תקינה"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(8, "סיסמה של 8 תווים לפחות").max(100),
});

export const POST = api(async (req) => {
  await limit(req, "signup", 10, 3600);
  const b = await parseJson(req, Body);
  const exists = await prisma.user.findUnique({ where: { email: b.email } });
  if (exists) throw conflict("email_taken", "כבר קיים חשבון עם האימייל הזה. נסו להתחבר.");
  const user = await prisma.user.create({
    data: { name: b.name, email: b.email, phone: b.phone || null, passwordHash: await hashPassword(b.password) },
  });
  await createSession(user.id);
  return { ok: true, userId: user.id };
});
