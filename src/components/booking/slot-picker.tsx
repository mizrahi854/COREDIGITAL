"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { CalendarX2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";

export type Slot = { start: string; end: string; staffIds: string[] };

/**
 * Date strip + time grid. All times are shown in the business timezone.
 * Availability always comes from the server; this component never computes it.
 */
export function SlotPicker({
  timezone,
  daysUrl,
  slotsUrl,
  date,
  onDate,
  value,
  onChange,
  refreshKey,
  days = 21,
}: {
  timezone: string;
  daysUrl?: string | null;
  slotsUrl: (date: string) => string | null;
  date: string | null;
  onDate: (d: string) => void;
  value: string | null;
  onChange: (slot: Slot | null) => void;
  refreshKey?: number;
  days?: number;
}) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const strip = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => {
    const start = DateTime.now().setZone(timezone).startOf("day");
    return Array.from({ length: days }, (_, i) => start.plus({ days: i }));
  }, [timezone, days]);

  useEffect(() => {
    if (!daysUrl) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    apiFetch<{ days: { date: string; count: number }[] }>(daysUrl)
      .then((r) => {
        if (cancelled) return;
        const c = Object.fromEntries(r.days.map((d) => [d.date, d.count]));
        setCounts(c);
        if (!date) {
          const first = r.days.find((d) => d.count > 0);
          if (first) onDate(first.date);
        }
      })
      .catch(() => !cancelled && setCounts({}));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysUrl, refreshKey]);

  const url = date ? slotsUrl(date) : null;
  useEffect(() => {
    if (!url) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setState("loading");
    apiFetch<{ slots: Slot[] }>(url)
      .then((r) => {
        if (cancelled) return;
        setSlots(r.slots);
        setState("idle");
        if (value && !r.slots.some((s) => s.start === value)) onChange(null);
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, refreshKey]);

  const groups = useMemo(() => {
    const g: { label: string; items: Slot[] }[] = [
      { label: "בוקר", items: [] },
      { label: "צהריים", items: [] },
      { label: "ערב", items: [] },
    ];
    for (const s of slots ?? []) {
      const h = DateTime.fromISO(s.start).setZone(timezone).hour;
      g[h < 12 ? 0 : h < 17 ? 1 : 2].items.push(s);
    }
    return g.filter((x) => x.items.length);
  }, [slots, timezone]);

  const nextAvailable = counts ? dates.find((d) => (counts[d.toISODate()!] ?? 0) > 0 && d.toISODate() !== date) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div ref={strip} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="listbox" aria-label="בחירת תאריך">
        {dates.map((d) => {
          const iso = d.toISODate()!;
          const count = counts?.[iso];
          const disabled = counts !== null && count === 0;
          const selected = iso === date;
          return (
            <button
              key={iso}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={`${d.setLocale("he").toFormat("cccc d בLLLL")}${disabled ? " — אין תורים פנויים" : ""}`}
              disabled={disabled}
              onClick={() => onDate(iso)}
              className={clsx(
                "flex h-[76px] w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border text-sm transition",
                selected ? "border-ink bg-ink text-cream" : "border-line bg-paper hover:bg-sand",
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              <span className={clsx("text-xs", selected ? "text-cream/75" : "text-muted")}>{d.setLocale("he").toFormat("ccc")}</span>
              <span className="ltr-nums text-lg font-semibold leading-none">{d.day}</span>
              <span className={clsx("h-1.5 w-1.5 rounded-full", count ? (selected ? "bg-bronze-soft" : "bg-bronze") : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="min-h-24">
        {!date && <p className="text-sm text-muted">בחרו תאריך כדי לראות שעות פנויות.</p>}
        {date && state === "loading" && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-sand" />
            ))}
            <span className="sr-only">טוען שעות פנויות</span>
          </div>
        )}
        {date && state === "error" && (
          <div className="flex items-center gap-3 rounded-2xl bg-bad-soft p-4 text-sm text-bad">
            לא הצלחנו לטעון שעות.
            <button type="button" className="inline-flex items-center gap-1 font-semibold underline" onClick={() => onDate(date)}>
              <RefreshCw className="size-4" aria-hidden /> נסו שוב
            </button>
          </div>
        )}
        {date && state === "idle" && slots && slots.length === 0 && (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-line p-4 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <CalendarX2 className="size-5 text-bronze-ink" aria-hidden /> אין שעות פנויות בתאריך הזה
            </span>
            {nextAvailable && (
              <button type="button" onClick={() => onDate(nextAvailable.toISODate()!)} className="font-semibold text-bronze-ink underline underline-offset-4">
                היום הפנוי הבא: {nextAvailable.setLocale("he").toFormat("cccc d בLLLL")}
              </button>
            )}
          </div>
        )}
        {date && state === "idle" && slots && slots.length > 0 && (
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="mb-2 text-xs font-medium text-muted">{g.label}</div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="listbox" aria-label={`שעות ${g.label}`}>
                  {g.items.map((s) => {
                    const t = DateTime.fromISO(s.start).setZone(timezone).toFormat("HH:mm");
                    const on = value === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => onChange(on ? null : s)}
                        className={clsx(
                          "ltr-nums h-11 rounded-xl border text-[15px] font-medium transition active:scale-95",
                          on ? "border-ink bg-ink text-cream" : "border-line bg-paper hover:border-bronze hover:bg-bronze-soft/50",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
