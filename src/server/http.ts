import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, badRequest } from "@/lib/errors";
import { rateLimit } from "./ratelimit";

type Handler<C> = (req: Request, ctx: C) => Promise<Response | unknown>;

/**
 * Wraps a route handler: maps AppError/Zod/Prisma errors to JSON responses
 * and serializes plain return values as JSON.
 */
export function api<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const out = await handler(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return NextResponse.json(
      { error: "validation", message: first?.message ?? "קלט לא תקין", issues: e.issues },
      { status: 400 },
    );
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
    return NextResponse.json({ error: "not_found", message: "הפריט לא נמצא" }, { status: 404 });
  }
  console.error("[api] unhandled", e);
  return NextResponse.json({ error: "server_error", message: "משהו השתבש. נסו שוב." }, { status: 500 });
}

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("גוף הבקשה אינו JSON תקין");
  }
  return schema.parse(body);
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export async function limit(req: Request, bucket: string, max: number, windowSec: number, extraKey = "") {
  await rateLimit(`${bucket}:${clientIp(req)}:${extraKey}`, max, windowSec);
}
