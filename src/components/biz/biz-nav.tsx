"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Clapperboard, ExternalLink, Scissors, Settings2, Smartphone, Users } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { Logo } from "../ui";

const OWNER = [
  { href: "/biz", label: "סקירה", icon: BarChart3 },
  { href: "/biz/calendar", label: "יומן", icon: CalendarDays },
  { href: "/biz/services", label: "שירותים", icon: Scissors },
  { href: "/biz/team", label: "צוות ושעות", icon: Users },
  { href: "/biz/reels", label: "רילס", icon: Clapperboard },
  { href: "/biz/profile", label: "פרופיל העסק", icon: Settings2 },
];
const STAFF = [{ href: "/biz/calendar", label: "היומן שלי", icon: CalendarDays }];

export function BizNav({
  role,
  business,
  memberships,
}: {
  role: "OWNER" | "STAFF";
  business: { id: string; name: string; slug: string; status: string };
  memberships: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = role === "OWNER" ? OWNER : STAFF;
  const isOn = (href: string) => (href === "/biz" ? pathname === "/biz" : pathname.startsWith(href));
  const switchTo = async (mode: "customer" | "business", id?: string) => {
    await apiFetch("/api/auth/mode", { body: { mode, businessId: id } });
    router.push(mode === "customer" ? "/" : "/biz");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-wide text-bronze-ink">ניהול העסק</div>
            <div className="truncate font-semibold">{business.name}</div>
          </div>
          <button onClick={() => switchTo("customer")} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium">
            <Smartphone className="size-4" aria-hidden /> מצב לקוח
          </button>
        </div>
        <nav aria-label="ניווט ניהול" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isOn(href) ? "page" : undefined} className={clsx("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium", isOn(href) ? "bg-ink text-cream" : "text-ink-2 hover:bg-sand")}>
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
      </header>

      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col border-e border-line bg-paper px-4 py-6 md:flex">
        <Link href="/biz" className="mb-1 px-3 text-xl">
          <Logo />
        </Link>
        <span className="mb-6 px-3 text-xs font-medium text-bronze-ink">ניהול העסק</span>
        <div className="mb-4 rounded-2xl bg-sand/60 p-3">
          {memberships.length > 1 ? (
            <select aria-label="בחירת עסק" className="w-full bg-transparent font-semibold" value={business.id} onChange={(e) => switchTo("business", e.target.value)}>
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="font-semibold">{business.name}</div>
          )}
          <Link href={`/b/${business.slug}`} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            הפרופיל הציבורי <ExternalLink className="size-3" aria-hidden />
          </Link>
        </div>
        <nav aria-label="ניווט ניהול" className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isOn(href) ? "page" : undefined} className={clsx("flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition", isOn(href) ? "bg-ink text-cream" : "text-ink-2 hover:bg-sand")}>
              <Icon className="size-5" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <button onClick={() => switchTo("customer")} className="mt-auto flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-ink-2 hover:bg-sand">
          <Smartphone className="size-5" aria-hidden /> מעבר למצב לקוח
        </button>
      </aside>
    </>
  );
}
