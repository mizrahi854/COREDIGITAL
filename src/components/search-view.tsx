"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import { CalendarCheck, Crosshair, Loader2, MapPin, Search, SearchX, SlidersHorizontal, Star, X } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { BUSINESS_TZ, CATEGORIES, CATEGORY_LABEL, CITIES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import type { Category } from "@prisma/client";
import { Avatar, Badge, Button, Chip, EmptyState, Field, Input, Select, Skeleton, buttonClass } from "./ui";
import { Sheet } from "./sheet";

type Result = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  city: string;
  categories: Category[];
  coverUrl: string | null;
  avatarUrl: string | null;
  isDemo: boolean;
  verified: boolean;
  services: { id: string; name: string; priceAgorot: number; mode: string }[];
  reelThumbs: { id: string; url: string | null }[];
  distanceKm: number | null;
  nextSlot: { start: string; serviceName: string } | null;
  _count: { reviews: number; followers: number };
};

const FILTER_KEYS = ["q", "city", "category", "service", "minPrice", "maxPrice", "date", "timeFrom", "timeTo", "today", "reviewsOnly", "lat", "lng", "maxKm", "approx"] as const;
const LS_KEY = "buber:lastSearch";

export function SearchView({ home, reviewsAvailable }: { home: { city: string; lat: number | null; lng: number | null } | null; reviewsAvailable: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) ?? ""])) as Record<(typeof FILTER_KEYS)[number], string>, [sp]);
  const [q, setQ] = useState(params.q);
  const [results, setResults] = useState<Result[] | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const [geo, setGeo] = useState<"idle" | "loading" | "denied">("idle");

  // Restore last search when arriving with no filters (filters persist per device).
  useEffect(() => {
    if (sp.toString()) return;
    try {
      const last = localStorage.getItem(LS_KEY);
      if (last) router.replace(`${pathname}?${last}`);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setQ(params.q);
    setDraft(params);
    const qs = sp.toString();
    try {
      localStorage.setItem(LS_KEY, qs);
    } catch {}
    let cancelled = false;
    setState("loading");
    apiFetch<{ results: Result[] }>(`/api/search?${qs}`)
      .then((r) => !cancelled && (setResults(r.results), setState("idle")))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [sp, params]);

  const apply = (next: Partial<typeof params>) => {
    const merged = { ...params, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v !== "" && v != null) as [string, string][]);
    router.replace(`${pathname}?${qs}`, { scroll: false });
  };

  const activeCount = FILTER_KEYS.filter((k) => k !== "q" && k !== "lat" && k !== "lng" && k !== "approx" && params[k]).length;
  const clearAll = () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
    router.replace(pathname);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGeo("denied");
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo("idle");
        setDraft((d) => ({ ...d, lat: p.coords.latitude.toFixed(4), lng: p.coords.longitude.toFixed(4), maxKm: d.maxKm || "10", approx: "", city: "" }));
      },
      () => setGeo("denied"),
      { timeout: 10000 },
    );
  };
  const useHome = () => {
    if (!home?.lat || !home.lng) return;
    setDraft((d) => ({ ...d, lat: String(home.lat), lng: String(home.lng), maxKm: d.maxKm || "10", approx: "1", city: "" }));
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:pt-10">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">חיפוש</h1>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="עסק, טיפול או סגנון — למשל ״בלייאז׳״" aria-label="חיפוש" className="ps-12" type="search" enterKeyHint="search" />
        </div>
        <button type="button" onClick={() => setOpen(true)} className={clsx(buttonClass("secondary", "md"), "relative shrink-0 px-4")} aria-label={`מסננים${activeCount ? ` (${activeCount} פעילים)` : ""}`}>
          <SlidersHorizontal className="size-5" aria-hidden />
          <span className="hidden sm:inline">מסננים</span>
          {activeCount > 0 && <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-bronze-ink text-[11px] font-bold text-white">{activeCount}</span>}
        </button>
      </form>

      {/* Quick chips */}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Chip active={params.today === "1"} onClick={() => apply({ today: params.today ? "" : "1", date: "" })}>
          <CalendarCheck className="size-4" aria-hidden /> פנוי היום
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={params.category === c.id} onClick={() => apply({ category: params.category === c.id ? "" : c.id })}>
            {c.short}
          </Chip>
        ))}
      </div>

      {/* Active filter summary */}
      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {params.city && <FilterTag label={params.city} onClear={() => apply({ city: "" })} />}
          {params.maxKm && params.lat && <FilterTag label={`עד ${params.maxKm} ק״מ${params.approx ? " (לפי העיר שלך)" : ""}`} onClear={() => apply({ maxKm: "", lat: "", lng: "", approx: "" })} />}
          {params.service && <FilterTag label={`שירות: ${params.service}`} onClear={() => apply({ service: "" })} />}
          {(params.minPrice || params.maxPrice) && <FilterTag label={`₪${params.minPrice || 0}–${params.maxPrice || "∞"}`} onClear={() => apply({ minPrice: "", maxPrice: "" })} />}
          {params.date && <FilterTag label={DateTime.fromISO(params.date).setLocale("he").toFormat("ccc d/M")} onClear={() => apply({ date: "" })} />}
          {(params.timeFrom || params.timeTo) && <FilterTag label={`${params.timeFrom || "00:00"}–${params.timeTo || "24:00"}`} onClear={() => apply({ timeFrom: "", timeTo: "" })} />}
          {params.reviewsOnly && <FilterTag label="עם ביקורות" onClear={() => apply({ reviewsOnly: "" })} />}
          <button onClick={clearAll} className="font-semibold text-bronze-ink underline underline-offset-4">
            ניקוי הכול
          </button>
        </div>
      )}

      <section className="mt-6" aria-live="polite" aria-busy={state === "loading"}>
        {state === "loading" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        )}
        {state === "error" && (
          <EmptyState title="החיפוש נכשל" text="בדקו את החיבור ונסו שוב." action={<Button onClick={() => router.refresh()}>נסו שוב</Button>} />
        )}
        {state === "idle" && results?.length === 0 && (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="לא מצאנו עסקים מתאימים"
            text={params.today || params.date ? "ייתכן שאין תורים פנויים במועד שבחרתם. נסו תאריך אחר או הסירו את מסנן הזמן." : "נסו מילה אחרת, עיר אחרת או פחות מסננים."}
            action={activeCount > 0 || params.q ? <Button variant="secondary" onClick={clearAll}>ניקוי מסננים</Button> : undefined}
          />
        )}
        {state === "idle" && results && results.length > 0 && (
          <>
            <p className="mb-3 text-sm text-muted">{results.length} עסקים</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <li key={r.id}>
                  <ResultCard r={r} approx={!!params.approx} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title="מסננים" className="md:max-w-xl">
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">מיקום</legend>
            <Select aria-label="עיר" value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value, lat: "", lng: "", maxKm: "", approx: "" }))}>
              <option value="">כל הערים</option>
              {CITIES.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={useMyLocation} className={buttonClass("secondary", "sm")}>
                {geo === "loading" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />} לפי המיקום שלי
              </button>
              {home?.lat && (
                <button type="button" onClick={useHome} className={buttonClass("secondary", "sm")}>
                  <MapPin className="size-4" aria-hidden /> ליד {home.city}
                </button>
              )}
            </div>
            {geo === "denied" && <p className="text-xs text-bad">אין הרשאת מיקום. בחרו עיר במקום.</p>}
            {draft.lat && (
              <Field label="מרחק מקסימלי" id="maxKm" hint={draft.approx ? "מחושב ממרכז העיר שבחרת בפרופיל — מרחק משוער." : "מחושב מהמיקום הנוכחי. עסקים בלי מיקום מוגדר לא יופיעו."}>
                <Select id="maxKm" value={draft.maxKm} onChange={(e) => setDraft((d) => ({ ...d, maxKm: e.target.value }))}>
                  {["2", "5", "10", "20", "50"].map((k) => (
                    <option key={k} value={k}>
                      עד {k} ק״מ
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </fieldset>

          <Field label="קטגוריה" id="cat">
            <Select id="cat" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
              <option value="">הכול</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="שירות מסוים" id="svc">
            <Input id="svc" value={draft.service} onChange={(e) => setDraft((d) => ({ ...d, service: e.target.value }))} placeholder="למשל: מניקור ג׳ל" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">טווח מחיר (₪)</legend>
            <div className="flex items-center gap-2">
              <Input inputMode="numeric" aria-label="מחיר מינימלי" placeholder="מ־" value={draft.minPrice} onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value.replace(/\D/g, "") }))} />
              <span aria-hidden>—</span>
              <Input inputMode="numeric" aria-label="מחיר מקסימלי" placeholder="עד" value={draft.maxPrice} onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">מתי?</legend>
            <div className="flex flex-col gap-2">
              <label className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-paper px-4">
                <input type="checkbox" className="size-5 accent-[var(--color-ink)]" checked={draft.today === "1"} onChange={(e) => setDraft((d) => ({ ...d, today: e.target.checked ? "1" : "", date: "" }))} />
                פנוי היום
              </label>
              {!draft.today && (
                <Input
                  type="date"
                  aria-label="תאריך"
                  value={draft.date}
                  min={DateTime.now().setZone(BUSINESS_TZ).toISODate()!}
                  onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                />
              )}
              <div className="flex items-center gap-2">
                <Input type="time" aria-label="משעה" value={draft.timeFrom} onChange={(e) => setDraft((d) => ({ ...d, timeFrom: e.target.value }))} />
                <span aria-hidden>—</span>
                <Input type="time" aria-label="עד שעה" value={draft.timeTo} onChange={(e) => setDraft((d) => ({ ...d, timeTo: e.target.value }))} />
              </div>
              {(draft.timeFrom || draft.timeTo) && !draft.today && !draft.date && <p className="text-xs text-muted">בחרו תאריך או ״פנוי היום״ כדי לסנן לפי שעה.</p>}
            </div>
          </fieldset>
          {reviewsAvailable && (
            <label className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-paper px-4">
              <input type="checkbox" className="size-5 accent-[var(--color-ink)]" checked={draft.reviewsOnly === "1"} onChange={(e) => setDraft((d) => ({ ...d, reviewsOnly: e.target.checked ? "1" : "" }))} />
              רק עסקים עם ביקורות מטיפולים שהושלמו
            </label>
          )}
          <div className="sticky bottom-0 -mx-5 flex gap-2 bg-cream px-5 pt-2">
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                apply(draft);
                setOpen(false);
              }}
            >
              הצגת תוצאות
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                clearAll();
                setOpen(false);
              }}
            >
              ניקוי
            </Button>
          </div>
        </div>
      </Sheet>
    </main>
  );
}

function FilterTag({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-sand ps-3 pe-1 text-sm">
      {label}
      <button onClick={onClear} className="grid size-6 place-items-center rounded-full hover:bg-sand-2" aria-label={`הסרת ${label}`}>
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function ResultCard({ r, approx }: { r: Result; approx: boolean }) {
  const min = r.services.length ? Math.min(...r.services.map((s) => s.priceAgorot)) : null;
  const next = r.nextSlot ? DateTime.fromISO(r.nextSlot.start).setZone(BUSINESS_TZ).setLocale("he") : null;
  return (
    <Link href={`/b/${r.slug}`} className="group block overflow-hidden rounded-[var(--radius-card)] bg-paper shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5">
      <div className="grid h-40 grid-cols-3 gap-0.5 bg-sand">
        {(r.reelThumbs.length >= 3 ? r.reelThumbs : r.reelThumbs.length ? [...r.reelThumbs, { id: "cover", url: r.coverUrl }] : [{ id: "cover", url: r.coverUrl }]).slice(0, 3).map((t, i, arr) => (
          <div key={t.id} className={clsx("overflow-hidden", arr.length === 1 && "col-span-3", arr.length === 2 && i === 1 && "col-span-2")}>
            {t.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.url} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2.5">
          <Avatar src={r.avatarUrl} name={r.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold">{r.name}</h3>
              {r.verified && <Badge tone="bronze">מאומת</Badge>}
            </div>
            <div className="truncate text-xs text-muted">
              {r.categories.map((c) => CATEGORY_LABEL[c]).join(" · ")} · {r.city}
              {r.distanceKm != null && (
                <span className="ltr-nums"> · {approx ? "~" : ""}{r.distanceKm < 1 ? `${Math.round(r.distanceKm * 1000)} מ׳` : `${r.distanceKm.toFixed(1)} ק״מ`}</span>
              )}
            </div>
          </div>
          {r._count.reviews > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted">
              <Star className="size-3.5 fill-bronze text-bronze" aria-hidden /> {r._count.reviews}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted">
            {r.services[0]?.name}
            {r.services.length > 1 ? ` ועוד ${r.services.length - 1}` : ""}
          </span>
          {min != null && <span className="ltr-nums shrink-0 font-semibold">{formatPrice(min, { from: true })}</span>}
        </div>
        {next && (
          <div className="flex items-center gap-1.5 rounded-xl bg-ok-soft px-3 py-1.5 text-xs font-medium text-ok">
            <CalendarCheck className="size-3.5" aria-hidden /> פנוי {next.toFormat("cccc")} ב־<span className="ltr-nums">{next.toFormat("HH:mm")}</span> · {r.nextSlot!.serviceName}
          </div>
        )}
        {r.isDemo && <span className="text-[11px] text-muted">עסק לדוגמה</span>}
      </div>
    </Link>
  );
}
