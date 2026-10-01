"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { Button, Chip, Field, Input, Select, Textarea } from "../ui";
import { Sheet } from "../sheet";
import { useToast } from "../toast";
import { SlotPicker, type Slot } from "../booking/slot-picker";

type Appt = {
  id: string;
  startsAt: string;
  endsAt: string;
  blockEndsAt: string;
  status: string;
  serviceName: string;
  staffId: string;
  guestName: string | null;
  customer: { name: string } | null;
  staff: { name: string };
  source: string;
};
type Staff = { id: string; name: string; hours: { weekday: number; startMin: number; endMin: number }[] };
type Service = { id: string; name: string; durationMin: number; priceAgorot: number; staffIds: string[] };

const START_H = 7;
const END_H = 22;
const PX_PER_MIN = 1.1;
const COLORS = ["#a8774c", "#6f8a76", "#8a6f8f", "#5f7f9a", "#b0705f", "#7d7a52"];

export function CalendarView({ timezone, role, staff, services }: { timezone: string; role: "OWNER" | "STAFF"; staff: Staff[]; services: Service[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<"day" | "week">("day");
  const [anchor, setAnchor] = useState(() => DateTime.now().setZone(timezone).startOf("day"));
  const [appts, setAppts] = useState<Appt[] | null>(null);
  const [error, setError] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [manual, setManual] = useState(sp.get("manual") === "1");
  const [reload, setReload] = useState(0);

  const range = useMemo(() => {
    const from = view === "day" ? anchor : anchor.minus({ days: anchor.weekday % 7 });
    return { from, to: from.plus({ days: view === "day" ? 1 : 7 }) };
  }, [anchor, view]);

  useEffect(() => {
    let cancelled = false;
    setAppts(null);
    setError(false);
    apiFetch<{ appointments: Appt[] }>(`/api/biz/appointments?from=${range.from.toUTC().toISO()}&to=${range.to.toUTC().toISO()}`)
      .then((r) => !cancelled && setAppts(r.appointments))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [range, reload]);

  const colorOf = (staffId: string) => COLORS[Math.max(0, staff.findIndex((s) => s.id === staffId)) % COLORS.length];
  const visible = (appts ?? []).filter((a) => showCancelled || !["CANCELLED", "DECLINED"].includes(a.status));
  const step = (n: number) => setAnchor((d) => d.plus({ days: n * (view === "day" ? 1 : 7) }));
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const height = (END_H - START_H) * 60 * PX_PER_MIN;

  const columns =
    view === "day"
      ? staff.map((s) => ({ key: s.id, label: s.name, day: anchor, filter: (a: Appt) => a.staffId === s.id, hours: s.hours.filter((h) => h.weekday === anchor.weekday % 7) }))
      : Array.from({ length: 7 }, (_, i) => {
          const day = range.from.plus({ days: i });
          return { key: day.toISODate()!, label: day.setLocale("he").toFormat("ccc d/M"), day, filter: (a: Appt) => DateTime.fromISO(a.startsAt).setZone(timezone).hasSame(day, "day"), hours: [] as Staff["hours"] };
        });

  const isToday = anchor.hasSame(DateTime.now().setZone(timezone), "day");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{role === "STAFF" ? "היומן שלי" : "יומן"}</h1>
        <Button onClick={() => setManual(true)}>
          <Plus className="size-4" aria-hidden /> תור ידני
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-sand p-1" role="tablist" aria-label="תצוגה">
          {(["day", "week"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={clsx("h-9 rounded-full px-4 text-sm font-medium", view === v ? "bg-paper shadow-sm" : "text-muted")}>
              {v === "day" ? "יום" : "שבוע"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="grid size-10 place-items-center rounded-full hover:bg-sand" aria-label="הקודם">
            <ChevronRight className="size-5" />
          </button>
          <button onClick={() => setAnchor(DateTime.now().setZone(timezone).startOf("day"))} className="h-10 rounded-full px-3 text-sm font-medium hover:bg-sand">
            היום
          </button>
          <button onClick={() => step(1)} className="grid size-10 place-items-center rounded-full hover:bg-sand" aria-label="הבא">
            <ChevronLeft className="size-5" />
          </button>
        </div>
        <span className="font-semibold">
          {view === "day"
            ? anchor.setLocale("he").toFormat("cccc, d בLLLL")
            : `${range.from.setLocale("he").toFormat("d בLLL")} – ${range.to.minus({ days: 1 }).setLocale("he").toFormat("d בLLL")}`}
          {view === "day" && isToday && <span className="ms-2 text-xs font-normal text-bronze-ink">(היום)</span>}
        </span>
        <label className="ms-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="size-4 accent-[var(--color-ink)]" />
          הצגת ביטולים
        </label>
      </div>

      {error && <p className="rounded-2xl bg-bad-soft p-4 text-sm text-bad">לא הצלחנו לטעון את היומן. <button className="underline" onClick={() => setReload((n) => n + 1)}>נסו שוב</button></p>}

      <div className="relative overflow-x-auto rounded-[var(--radius-card)] bg-paper shadow-[var(--shadow-soft)]">
        {!appts && !error && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-paper/60">
            <Loader2 className="size-7 animate-spin text-muted" aria-label="טוען" />
          </div>
        )}
        <div className="flex min-w-full">
          {/* time axis */}
          <div className="sticky start-0 z-[5] w-14 shrink-0 border-e border-line bg-paper">
            <div className="h-12 border-b border-line" />
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <span key={h} className="ltr-nums absolute start-2 -translate-y-2 text-[11px] text-muted" style={{ top: (h - START_H) * 60 * PX_PER_MIN }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.key} className={clsx("relative shrink-0 border-e border-line last:border-e-0", view === "day" ? "min-w-56 flex-1" : "min-w-36 flex-1")}>
              <div className={clsx("sticky top-0 flex h-12 items-center justify-center border-b border-line px-2 text-sm font-semibold", view === "week" && col.day.hasSame(DateTime.now().setZone(timezone), "day") && "text-bronze-ink")}>
                {col.label}
              </div>
              <div className="relative" style={{ height }}>
                {/* working hours shading */}
                {col.hours.map((h, i) => (
                  <div key={i} className="absolute inset-x-0 bg-bronze-soft/25" style={{ top: (h.startMin - START_H * 60) * PX_PER_MIN, height: (h.endMin - h.startMin) * PX_PER_MIN }} aria-hidden />
                ))}
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - START_H) * 60 * PX_PER_MIN }} aria-hidden />
                ))}
                {visible.filter(col.filter).map((a) => {
                  const s = DateTime.fromISO(a.startsAt).setZone(timezone);
                  const e = DateTime.fromISO(a.endsAt).setZone(timezone);
                  const top = (s.hour * 60 + s.minute - START_H * 60) * PX_PER_MIN;
                  const h = Math.max(26, e.diff(s, "minutes").minutes * PX_PER_MIN);
                  const pending = a.status === "REQUESTED" || a.status === "PROPOSED";
                  const off = ["CANCELLED", "DECLINED", "NO_SHOW"].includes(a.status);
                  return (
                    <Link
                      key={a.id}
                      href={`/biz/appointments/${a.id}`}
                      className={clsx(
                        "absolute inset-x-1 overflow-hidden rounded-xl px-2 py-1 text-xs leading-tight shadow-sm transition hover:z-10 hover:shadow-md",
                        pending ? "border-2 border-dashed bg-paper" : "text-white",
                        off && "opacity-45 line-through",
                      )}
                      style={{ top, height: h, background: pending ? undefined : colorOf(a.staffId), borderColor: pending ? colorOf(a.staffId) : undefined }}
                    >
                      <div className="ltr-nums font-semibold">{s.toFormat("HH:mm")}</div>
                      <div className="truncate font-medium">{a.customer?.name ?? a.guestName ?? "לקוח"}</div>
                      <div className="truncate opacity-85">
                        {a.serviceName}
                        {view === "week" && ` · ${a.staff.name}`}
                      </div>
                      {pending && <div className="font-semibold text-warn">בקשה — לא שמור</div>}
                      {a.source === "REEL" && !pending && <div className="opacity-85">מרילס ✦</div>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {columns.length === 0 && <div className="p-8 text-sm text-muted">אין אנשי צוות פעילים. הוסיפו צוות בעמוד ״צוות ושעות״.</div>}
        </div>
      </div>
      {appts && visible.length === 0 && <p className="text-center text-sm text-muted">אין תורים בטווח הזה.</p>}

      <ManualBooking
        key={anchor.toISODate()}
        open={manual}
        onClose={() => {
          setManual(false);
          if (sp.get("manual")) router.replace("/biz/calendar");
        }}
        onDone={() => setReload((n) => n + 1)}
        timezone={timezone}
        staff={staff}
        services={services}
        defaultDate={anchor.toISODate()!}
      />
    </div>
  );
}

function ManualBooking({
  open,
  onClose,
  onDone,
  timezone,
  staff,
  services,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  timezone: string;
  staff: Staff[];
  services: Service[];
  defaultDate: string;
}) {
  const toast = useToast();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const svc = services.find((s) => s.id === serviceId);
  const eligible = staff.filter((s) => svc?.staffIds.includes(s.id));
  const [staffChoice, setStaffId] = useState("");
  const [date, setDate] = useState<string | null>(defaultDate);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const staffId = eligible.some((s) => s.id === staffChoice) ? staffChoice : (eligible[0]?.id ?? "");

  const slotsUrl = (d: string) => (serviceId && staffId ? `/api/biz/availability?serviceId=${serviceId}&staffId=${staffId}&date=${d}` : null);

  const submit = async () => {
    if (!slot) return;
    setBusy(true);
    try {
      await apiFetch("/api/biz/appointments", { body: { serviceId, staffId, startsAt: slot.start, guestName, guestPhone: guestPhone || undefined, notes: notes || undefined } });
      toast({ kind: "ok", text: "התור נוסף ליומן" });
      setSlot(null);
      setGuestName("");
      setGuestPhone("");
      setNotes("");
      onDone();
      onClose();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="תור ידני (טלפון / הגעה למקום)" className="md:max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="שירות" id="m-svc">
            <Select id="m-svc" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(null); }}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="איש צוות" id="m-staff">
            <Select id="m-staff" value={staffId} onChange={(e) => { setStaffId(e.target.value); setSlot(null); }}>
              {eligible.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <SlotPicker timezone={timezone} slotsUrl={slotsUrl} date={date} onDate={(d) => { setDate(d); setSlot(null); }} value={slot?.start ?? null} onChange={setSlot} days={30} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="שם הלקוח/ה" id="m-name">
            <Input id="m-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </Field>
          <Field label="טלפון" id="m-phone">
            <Input id="m-phone" type="tel" dir="ltr" className="text-start" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </Field>
        </div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות פנימיות" aria-label="הערות" />
        <div className="flex flex-wrap gap-2">
          {[guestName.trim().length < 2 && "שם לקוח", !slot && "שעה"].filter(Boolean).map((m) => (
            <Chip key={String(m)} disabled className="h-7 px-3 text-xs">
              חסר: {m}
            </Chip>
          ))}
        </div>
        <Button size="lg" onClick={submit} loading={busy} disabled={!slot || guestName.trim().length < 2}>
          הוספה ליומן
        </Button>
      </div>
    </Sheet>
  );
}
