"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Copy, ImagePlus, Trash2 } from "lucide-react";
import type { Category } from "@prisma/client";
import { apiFetch } from "@/lib/client";
import { CITIES, WEEKDAYS_HE } from "@/lib/constants";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/format";
import { Avatar, Button, Card, Field, Input, Select, Textarea } from "../ui";
import { InterestPicker } from "../area-interests";
import { useToast } from "../toast";

type B = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categories: Category[];
  city: string;
  address: string;
  phone: string;
  instagram: string;
  lat: number | null;
  lng: number | null;
  cancellationHours: number;
  cancellationPolicy: string;
  coverUrl: string | null;
  avatarUrl: string | null;
};

export function BizProfileForm({ business, hours, portfolio }: { business: B; hours: { weekday: number; openMin: number; closeMin: number }[]; portfolio: { id: string; url: string; caption: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [b, setB] = useState(business);
  const [rows, setRows] = useState(
    WEEKDAYS_HE.map((_, d) => {
      const h = hours.find((x) => x.weekday === d);
      return { on: !!h, open: minutesToHHMM(h?.openMin ?? 540), close: minutesToHHMM(h?.closeMin ?? 1140) };
    }),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const set = (k: keyof B) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setB({ ...b, [k]: e.target.value });

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      await apiFetch("/api/biz/profile", {
        method: "PUT",
        body: {
          name: b.name,
          tagline: b.tagline,
          description: b.description,
          categories: b.categories,
          city: b.city,
          address: b.address,
          phone: b.phone,
          instagram: b.instagram,
          lat: b.lat,
          lng: b.lng,
          cancellationHours: Number(b.cancellationHours) || 0,
          cancellationPolicy: b.cancellationPolicy,
          openingHours: rows.flatMap((r, d) => (r.on ? [{ weekday: d, openMin: hhmmToMinutes(r.open), closeMin: hhmmToMinutes(r.close) }] : [])),
        },
      });
      toast({ kind: "ok", text: "הפרופיל נשמר. תורים קיימים שומרים על מדיניות הביטול שהייתה בעת ההזמנה." });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const upload = async (kind: "cover" | "avatar" | "portfolio", file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    if (kind === "portfolio") fd.set("rightsConfirmed", String(rights));
    setBusy(kind);
    try {
      await apiFetch("/api/biz/images", { form: fd });
      toast({ kind: "ok", text: "התמונה עודכנה" });
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/b/${b.slug}` : `/b/${b.slug}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">פרופיל העסק</h1>
        <button
          onClick={() => navigator.clipboard.writeText(publicUrl).then(() => toast({ kind: "ok", text: "הקישור הועתק" }))}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm"
        >
          <Copy className="size-4" aria-hidden /> <span className="ltr-nums">/b/{b.slug}</span>
        </button>
      </div>

      <Card className="overflow-hidden">
        <label className="relative block h-44 cursor-pointer bg-sand md:h-56">
          {business.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.coverUrl} alt="" className="size-full object-cover" />
          )}
          <span className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-cream/90 px-3 py-1.5 text-sm font-medium">
            <Camera className="size-4" aria-hidden /> {busy === "cover" ? "מעלה…" : "תמונת שער"}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload("cover", e.target.files[0])} />
        </label>
        <div className="flex items-center gap-4 p-5">
          <label className="relative -mt-14 cursor-pointer" aria-label="החלפת לוגו">
            <Avatar src={business.avatarUrl} name={b.name} size={88} className="ring-4 ring-paper" />
            <span className="absolute bottom-0 end-0 grid size-8 place-items-center rounded-full bg-ink text-cream">
              <Camera className="size-4" aria-hidden />
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload("avatar", e.target.files[0])} />
          </label>
          <p className="text-sm text-muted">JPG / PNG / WEBP עד 8MB. מטא־דאטה (כולל מיקום) מוסרים אוטומטית.</p>
        </div>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="שם העסק" id="b-name">
          <Input id="b-name" value={b.name} onChange={set("name")} />
        </Field>
        <Field label="משפט קצר" id="b-tag">
          <Input id="b-tag" value={b.tagline} onChange={set("tagline")} maxLength={80} />
        </Field>
        <div className="md:col-span-2">
          <Field label="תיאור" id="b-desc">
            <Textarea id="b-desc" value={b.description} onChange={set("description")} rows={4} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-ink-2">קטגוריות</span>
          <InterestPicker value={b.categories} onChange={(v) => setB({ ...b, categories: v })} />
        </div>
        <Field label="עיר" id="b-city">
          <Select id="b-city" value={b.city} onChange={set("city")}>
            {CITIES.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="כתובת" id="b-addr">
          <Input id="b-addr" value={b.address} onChange={set("address")} />
        </Field>
        <Field label="טלפון" id="b-phone">
          <Input id="b-phone" type="tel" dir="ltr" className="text-start" value={b.phone} onChange={set("phone")} />
        </Field>
        <Field label="אינסטגרם" id="b-ig">
          <Input id="b-ig" dir="ltr" className="text-start" value={b.instagram} onChange={set("instagram")} placeholder="@" />
        </Field>
        <Field label="מיקום מדויק (קו רוחב, קו אורך)" id="b-lat" hint="משמש לחישוב מרחק בחיפוש. בלי מיקום — לא יוצג מרחק.">
          <div className="flex gap-2">
            <Input id="b-lat" inputMode="decimal" dir="ltr" placeholder="32.08" value={b.lat ?? ""} onChange={(e) => setB({ ...b, lat: e.target.value ? Number(e.target.value) : null })} />
            <Input aria-label="קו אורך" inputMode="decimal" dir="ltr" placeholder="34.78" value={b.lng ?? ""} onChange={(e) => setB({ ...b, lng: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </Field>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-semibold">מדיניות ביטול</h2>
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <Field label="ביטול חינם עד (שעות לפני)" id="b-ch">
            <Input id="b-ch" inputMode="numeric" value={b.cancellationHours} onChange={(e) => setB({ ...b, cancellationHours: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </Field>
          <Field label="טקסט המדיניות שיוצג ללקוחות" id="b-cp">
            <Textarea id="b-cp" value={b.cancellationPolicy} onChange={set("cancellationPolicy")} />
          </Field>
        </div>
        <p className="text-xs text-muted">השינוי חל על הזמנות חדשות בלבד — כל תור שומר את המדיניות שהייתה בתוקף כשנקבע.</p>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-semibold">שעות פתיחה (לתצוגה בפרופיל)</h2>
        <p className="text-xs text-muted">הזמינות להזמנות נקבעת לפי שעות העבודה של כל איש צוות.</p>
        {rows.map((r, d) => (
          <div key={d} className="flex flex-wrap items-center gap-2">
            <label className="flex w-20 items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-[var(--color-ink)]" checked={r.on} onChange={(e) => setRows(rows.map((x, i) => (i === d ? { ...x, on: e.target.checked } : x)))} />
              {WEEKDAYS_HE[d]}
            </label>
            {r.on ? (
              <>
                <Input type="time" className="h-10 w-28" aria-label={`פתיחה ${WEEKDAYS_HE[d]}`} value={r.open} onChange={(e) => setRows(rows.map((x, i) => (i === d ? { ...x, open: e.target.value } : x)))} />
                <span aria-hidden>–</span>
                <Input type="time" className="h-10 w-28" aria-label={`סגירה ${WEEKDAYS_HE[d]}`} value={r.close} onChange={(e) => setRows(rows.map((x, i) => (i === d ? { ...x, close: e.target.value } : x)))} />
              </>
            ) : (
              <span className="text-sm text-muted">סגור</span>
            )}
          </div>
        ))}
      </Card>

      {error && <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      <Button size="lg" onClick={save} loading={busy === "save"}>
        שמירת הפרופיל
      </Button>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-semibold">תיק עבודות (תמונות)</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-ink)]" checked={rights} onChange={(e) => setRights(e.target.checked)} />
          אני מאשר/ת שיש לי זכויות בתמונות ושכל אדם מזוהה נתן הסכמה לפרסום.
        </label>
        <label className={`inline-flex h-11 cursor-pointer items-center gap-2 self-start rounded-full border border-line bg-paper px-4 text-sm font-medium ${rights ? "hover:bg-sand" : "pointer-events-none opacity-50"}`}>
          <ImagePlus className="size-4" aria-hidden /> {busy === "portfolio" ? "מעלה…" : "הוספת תמונה"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!rights} onChange={(e) => e.target.files?.[0] && upload("portfolio", e.target.files[0])} />
        </label>
        <ul className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {portfolio.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption} className="size-full object-cover" />
              <button
                onClick={async () => {
                  await apiFetch(`/api/biz/portfolio/${p.id}`, { method: "DELETE" });
                  router.refresh();
                }}
                className="absolute end-1 top-1 grid size-8 place-items-center rounded-full bg-black/50 text-white"
                aria-label="מחיקת תמונה"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
