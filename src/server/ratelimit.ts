import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter backed by Postgres so it holds across server processes.
 * For high traffic, swap for Redis behind the same function.
 */
export async function rateLimit(key: string, max: number, windowSec: number) {
  if (process.env.RATE_LIMIT_DISABLED === "true") return;
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitHit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitHit"."count" + 1
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > max) {
    throw new AppError(429, "rate_limited", "יותר מדי בקשות. נסו שוב בעוד רגע.");
  }
}
