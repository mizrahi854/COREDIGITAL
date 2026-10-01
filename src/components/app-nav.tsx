"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Bookmark, CalendarDays, UserRound, Store, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./ui";
import { useViewer } from "./viewer";

const ITEMS = [
  { href: "/", label: "בית", icon: Home },
  { href: "/search", label: "חיפוש", icon: Search },
  { href: "/saved", label: "שמורים", icon: Bookmark },
  { href: "/appointments", label: "תורים", icon: CalendarDays },
  { href: "/profile", label: "פרופיל", icon: UserRound },
];

export function AppNav() {
  const pathname = usePathname();
  const { viewer } = useViewer();
  const dark = pathname === "/" || pathname.startsWith("/reel/");
  const active = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/reel/") : pathname.startsWith(href));

  return (
    <>
      {/* Mobile bottom bar */}
      <nav
        aria-label="ניווט ראשי"
        className={clsx(
          "fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] md:hidden",
          dark ? "on-dark border-white/10 bg-night/85 text-cream backdrop-blur-xl" : "border-line bg-paper/90 text-ink backdrop-blur-xl",
        )}
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={clsx(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                    on ? (dark ? "text-cream" : "text-ink") : dark ? "text-cream/60" : "text-muted",
                  )}
                >
                  <Icon className={clsx("size-[22px]", on && "stroke-[2.4]")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop rail (start side = right in RTL) */}
      <nav
        aria-label="ניווט ראשי"
        className={clsx(
          "fixed inset-y-0 start-0 z-50 hidden w-60 flex-col gap-1 border-e px-4 py-6 md:flex",
          dark ? "on-dark border-white/10 bg-night text-cream" : "border-line bg-paper text-ink",
        )}
      >
        <Link href="/" className="mb-8 px-3 text-2xl" aria-label="BUBER — דף הבית">
          <Logo dark={dark} />
        </Link>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = active(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={clsx(
                "flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition",
                on ? (dark ? "bg-white/10" : "bg-sand") : dark ? "text-cream/70 hover:bg-white/5" : "text-muted hover:bg-sand/60",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col gap-1">
          {viewer?.businesses.length ? (
            <Link href="/biz" className={clsx("flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium", dark ? "text-cream/80 hover:bg-white/5" : "text-ink-2 hover:bg-sand")}>
              <Store className="size-5" aria-hidden /> מעבר לניהול העסק
            </Link>
          ) : (
            <Link href="/biz/new" className={clsx("flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium", dark ? "text-cream/80 hover:bg-white/5" : "text-ink-2 hover:bg-sand")}>
              <Store className="size-5" aria-hidden /> יש לך עסק? הצטרפות
            </Link>
          )}
          {viewer?.isAdmin && (
            <Link href="/admin" className={clsx("flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium", dark ? "text-cream/80 hover:bg-white/5" : "text-ink-2 hover:bg-sand")}>
              <ShieldCheck className="size-5" aria-hidden /> ניהול מערכת
            </Link>
          )}
          {!viewer && (
            <Link href="/login" className={clsx("mt-2 flex h-11 items-center justify-center rounded-full text-sm font-semibold", dark ? "bg-cream text-ink" : "bg-ink text-cream")}>
              התחברות / הרשמה
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
