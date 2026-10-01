import { NextResponse, type NextRequest } from "next/server";

/**
 * Network-edge checks only (authorization happens in each route handler):
 * - Mutating API requests must come from this origin (CSRF defense on top of SameSite=Lax cookies).
 * - Baseline security headers.
 */
export function proxy(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (req.nextUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin) {
      let ok = false;
      try {
        ok = new URL(origin).host === host;
      } catch {}
      if (!ok) {
        return NextResponse.json({ error: "bad_origin", message: "בקשה ממקור לא מורשה" }, { status: 403 });
      }
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "bad_origin", message: "בקשה ממקור לא מורשה" }, { status: 403 });
    }
  }
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
