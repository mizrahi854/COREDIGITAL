"use client";

import { useState } from "react";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import type { Category } from "@prisma/client";
import { CATEGORIES, CITIES } from "@/lib/constants";
import { Chip, Field, Select } from "./ui";

export type AreaValue = { city: string | null; lat: number | null; lng: number | null };

/** Area: manual city choice, or browser geolocation only after the user asks for it. */
export function AreaPicker({ value, onChange }: { value: AreaValue; onChange: (v: AreaValue) => void }) {
  const [geo, setGeo] = useState<"idle" | "loading" | "denied" | "ok">("idle");
  const locate = () => {
    if (!navigator.geolocation) return setGeo("denied");
    setGeo("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // nearest known city for display
        const nearest = CITIES.map((c) => ({ c, d: (c.lat - lat) ** 2 + (c.lng - lng) ** 2 })).sort((a, b) => a.d - b.d)[0]?.c;
        onChange({ city: nearest?.name ?? value.city, lat, lng });
        setGeo("ok");
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label="עיר" id="city">
        <Select
          id="city"
          value={value.city ?? ""}
          onChange={(e) => {
            const c = CITIES.find((x) => x.name === e.target.value);
            onChange({ city: c?.name ?? null, lat: c?.lat ?? null, lng: c?.lng ?? null });
            setGeo("idle");
          }}
        >
          <option value="">בחרו עיר</option>
          {CITIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <button type="button" onClick={locate} className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-line bg-paper px-4 text-sm font-medium hover:bg-sand">
        {geo === "loading" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
        שימוש במיקום הנוכחי
      </button>
      <p className="text-xs text-muted" aria-live="polite">
        {geo === "denied"
          ? "לא קיבלנו הרשאת מיקום — אפשר פשוט לבחור עיר."
          : geo === "ok"
            ? "המיקום נשמר ומשמש רק לחישוב מרחק לעסקים."
            : "המיקום שלך נשאל רק אם תלחצו על הכפתור, ומשמש רק לחישוב מרחק."}
      </p>
      {value.city && (
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="size-4 text-bronze-ink" aria-hidden /> {value.city}
        </p>
      )}
    </div>
  );
}

export function InterestPicker({ value, onChange }: { value: Category[]; onChange: (v: Category[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="תחומי עניין">
      {CATEGORIES.map((c) => {
        const on = value.includes(c.id);
        return (
          <Chip key={c.id} active={on} onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}>
            {c.label}
          </Chip>
        );
      })}
    </div>
  );
}
