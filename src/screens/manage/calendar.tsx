import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Ban, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { DateTime } from "luxon";
import type { Appointment, BlockedTime, Professional } from "../../domain/types";
import { getSlots } from "../../domain/booking";
import { WEEKDAYS, WEEKDAYS_SHORT } from "../../domain/format";
import { TZ, atMinute, fmtTime, hhmmToMin, minToHHMM } from "../../domain/time";
import { addBlockedTime, createManualAppointment, removeBlockedTime } from "../../store/actions";
import { toast } from "../../store/app";
import { calendarLabel } from "../../integrations/googleCalendar";
import { Badge, Button, Field, Input, Segmented, Select } from "../../ui/kit";
import { ConfirmDialog, Sheet } from "../../ui/overlays";
import { TopBar } from "../../ui/shell";
import { customerName, useBiz } from "./common";

const START_H = 7;
const END_H = 22;
const PX_PER_MIN = 1.1;

const TONE: Record<string, string> = {
  confirmed: "bg-ink text-ink-inverse",
  pending_approval: "bg-warn-soft text-warn border border-warn/40 border-dashed",
  pending_payment: "bg-info-soft text-info border border-info/40 border-dashed",
  completed: "bg-surface-2 text-ink",
  no_show: "bg-bad-soft text-bad line-through",
};

export function CalendarScreen() {
  const { db, business: b, isStaff, pros, appointments } = useBiz();
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(() => DateTime.now().setZone(TZ).startOf("day"));
  const [proFilter, setProFilter] = useState<string>("all");
  const [manual, setManual] = useState(false);
  const [block, setBlock] = useState(false);
  const [removeBlock, setRemoveBlock] = useState<BlockedTime | null>(null);

  const shownPros = pros.filter((p) => p.active && (proFilter === "all" || p.id === proFilter));
  const days = view === "day" ? [date] : Array.from({ length: 7 }, (_, i) => date.minus({ days: date.weekday % 7 }).plus({ days: i }));
  const visible = appointments.filter((a) => !["cancelled", "rejected"].includes(a.status));
  const blocks = db.blockedTimes.filter((x) => x.businessId === b.id && shownPros.some((p) => p.id === x.professionalId));
  const step = view === "day" ? 1 : 7;
  const title = view === "day" ? `${WEEKDAYS[date.weekday % 7]}, ${date.toFormat("d/M")}` : `${days[0].toFormat("d/M")}–${days[6].toFormat("d/M")}`;

  return (
    <>
      <TopBar title="יומן" sub={b.name} back="/manage" />
      <div className="mx-auto max-w-6xl px-3 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center gap-2 py-3">
          <Segmented
            label="תצוגה"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "יום" },
              { value: "week", label: "שבוע" },
            ]}
          />
          <div className="flex items-center">
            <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-surface" aria-label="הקודם" onClick={() => setDate((d) => d.minus({ days: step }))}>
              <ChevronRight className="size-5" />
            </button>
            <span className="num min-w-28 text-center font-bold">{title}</span>
            <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-surface" aria-label="הבא" onClick={() => setDate((d) => d.plus({ days: step }))}>
              <ChevronLeft className="size-5" />
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setDate(DateTime.now().setZone(TZ).startOf("day"))}>
            היום
          </Button>
          {!isStaff && (
            <Select aria-label="סינון לפי איש צוות" className="h-10 w-auto min-w-36" value={proFilter} onChange={(e) => setProFilter(e.target.value)}>
              <option value="all">כל הצוות</option>
              {pros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={() => setBlock(true)}>
            <Ban className="size-4" aria-hidden /> חסימת זמן
          </Button>
          <Button size="sm" onClick={() => setManual(true)}>
            <Plus className="size-4" aria-hidden /> תור ידני
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Legend cls={TONE.confirmed} label="מאושר" />
          <Legend cls={TONE.pending_approval} label="ממתין לאישור" />
          <Legend cls={TONE.pending_payment} label="ממתין למקדמה" />
          <Legend cls="bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_4px,var(--surface)_4px,var(--surface)_8px)]" label="חסום / הפסקה" />
          <span className="ms-auto">
            Google Calendar: <Badge tone={b.calendar.status === "connected" ? "ok" : b.calendar.status === "error" ? "bad" : "outline"}>{calendarLabel(b.calendar)}</Badge>
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line">
          <div className="flex min-w-full">
            <TimeAxis />
            {days.map((d) =>
              view === "day" ? (
                shownPros.map((p) => <Column key={p.id + d.toISODate()} day={d} pro={p} label={p.name} appts={visible.filter((a) => a.professionalId === p.id)} blocks={blocks.filter((x) => x.professionalId === p.id)} onBlock={setRemoveBlock} customer={(a) => customerName(db, a)} />)
              ) : (
                <WeekColumn key={d.toISODate()} day={d} pros={shownPros} appts={visible.filter((a) => shownPros.some((p) => p.id === a.professionalId))} blocks={blocks} customer={(a) => customerName(db, a)} onBlock={setRemoveBlock} />
              ),
            )}
          </div>
        </div>
        {shownPros.length === 0 && <p className="mt-4 text-sm text-muted">אין אנשי צוות פעילים.</p>}
        {!isStaff && (
          <p className="mt-3 text-xs text-muted">
            שעות עבודה והפסקות מוגדרות ב<Link to="/manage/staff" className="underline">צוות</Link>. אזורים אפורים הם מחוץ לשעות העבודה.
          </p>
        )}
      </div>
      <ManualBookingSheet open={manual} onClose={() => setManual(false)} initialDate={date.toISODate()!} />
      <BlockTimeSheet open={block} onClose={() => setBlock(false)} initialDate={date.toISODate()!} />
      <ConfirmDialog
        open={!!removeBlock}
        onClose={() => setRemoveBlock(null)}
        title="להסיר את החסימה?"
        body={removeBlock ? `${removeBlock.reason} · ${fmtTime(removeBlock.start)}–${fmtTime(removeBlock.end)}` : ""}
        confirmLabel="הסרה"
        danger
        onConfirm={() => removeBlock && removeBlockedTime(removeBlock.id) !== undefined && toast("ok", "החסימה הוסרה")}
      />
    </>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx("size-3 rounded", cls)} aria-hidden /> {label}
    </span>
  );
}

function TimeAxis() {
  return (
    <div className="sticky start-0 z-10 w-12 shrink-0 border-e border-line bg-bg">
      <div className="h-10 border-b border-line" />
      <div className="relative" style={{ height: (END_H - START_H) * 60 * PX_PER_MIN }}>
        {Array.from({ length: END_H - START_H }, (_, i) => (
          <span key={i} className="num absolute end-1.5 -translate-y-1/2 text-[11px] text-muted" style={{ top: i * 60 * PX_PER_MIN }}>
            {i === 0 ? "" : `${START_H + i}:00`}
          </span>
        ))}
      </div>
    </div>
  );
}

const minOfDay = (iso: string, day: DateTime) => (Date.parse(iso) - day.toMillis()) / 60000;

function Column({ day, pro, label, appts, blocks, customer, onBlock, narrow }: { day: DateTime; pro: Professional; label: string; appts: Appointment[]; blocks: BlockedTime[]; customer: (a: Appointment) => string; onBlock: (b: BlockedTime) => void; narrow?: boolean }) {
  const wd = day.weekday % 7;
  const work = pro.workingHours.filter((h) => h.weekday === wd);
  const breaks = pro.breaks.filter((h) => h.weekday === wd);
  const dayEnd = day.plus({ days: 1 });
  const items = appts.filter((a) => Date.parse(a.start) < dayEnd.toMillis() && Date.parse(a.end) > day.toMillis());
  const blk = blocks.filter((x) => Date.parse(x.start) < dayEnd.toMillis() && Date.parse(x.end) > day.toMillis());
  const top = (m: number) => Math.max(0, (m - START_H * 60) * PX_PER_MIN);
  const isToday = day.hasSame(DateTime.now().setZone(TZ), "day");
  const nowMin = isToday ? minOfDay(new Date().toISOString(), day) : -1;
  return (
    <div className={clsx("shrink-0 border-e border-line last:border-e-0", narrow ? "w-full" : "min-w-44 flex-1 sm:min-w-52")}>
      <div className="sticky top-0 flex h-10 items-center justify-center border-b border-line bg-bg px-2 text-sm font-semibold">{label}</div>
      <div className="relative bg-surface/70" style={{ height: (END_H - START_H) * 60 * PX_PER_MIN }}>
        {Array.from({ length: END_H - START_H }, (_, i) => (
          <div key={i} className="absolute inset-x-0 border-t border-line/60" style={{ top: i * 60 * PX_PER_MIN }} />
        ))}
        {work.map((w, i) => (
          <div key={i} className="absolute inset-x-0 bg-bg" style={{ top: top(w.start), height: (w.end - w.start) * PX_PER_MIN }} />
        ))}
        {breaks.map((w, i) => (
          <div key={`b${i}`} className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_4px,var(--surface)_4px,var(--surface)_8px)] text-center text-[11px] text-muted" style={{ top: top(w.start), height: (w.end - w.start) * PX_PER_MIN }}>
            הפסקה
          </div>
        ))}
        {blk.map((x) => {
          const s = Math.max(minOfDay(x.start, day), START_H * 60);
          const e = Math.min(minOfDay(x.end, day), END_H * 60);
          return (
            <button key={x.id} type="button" onClick={() => onBlock(x)} className="absolute inset-x-1 flex items-start justify-between rounded-lg bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_4px,var(--surface)_4px,var(--surface)_8px)] p-1.5 text-start text-[11px] font-semibold text-muted" style={{ top: top(s), height: Math.max(18, (e - s) * PX_PER_MIN) }} aria-label={`חסום: ${x.reason}. לחצו להסרה`}>
              {x.reason}
              <Trash2 className="size-3" aria-hidden />
            </button>
          );
        })}
        {items.map((a) => {
          const s = minOfDay(a.start, day);
          const e = minOfDay(a.end, day);
          return (
            <Link key={a.id} to={`/manage/appointments/${a.id}`} className={clsx("absolute inset-x-1 overflow-hidden rounded-lg p-1.5 text-[11px] leading-tight shadow-sm transition hover:brightness-110", TONE[a.status] ?? TONE.confirmed)} style={{ top: top(s), height: Math.max(22, (e - s) * PX_PER_MIN - 2) }}>
              <span className="num block font-bold">
                {fmtTime(a.start)} {customer(a)}
              </span>
              <span className="block truncate opacity-80">{a.snapshot.serviceName}</span>
            </Link>
          );
        })}
        {nowMin > START_H * 60 && nowMin < END_H * 60 && <div className="absolute inset-x-0 z-10 h-0.5 bg-bad" style={{ top: top(nowMin) }} aria-label="עכשיו" />}
      </div>
    </div>
  );
}

function WeekColumn({ day, pros, appts, blocks, customer, onBlock }: { day: DateTime; pros: Professional[]; appts: Appointment[]; blocks: BlockedTime[]; customer: (a: Appointment) => string; onBlock: (b: BlockedTime) => void }) {
  // In week view the column uses the union of the selected team's hours; each appointment shows the professional initial.
  const merged: Professional = useMemo(
    () => ({ ...pros[0], id: "merged", workingHours: pros.flatMap((p) => p.workingHours), breaks: pros.length === 1 ? pros[0].breaks : [] }),
    [pros],
  );
  if (!pros.length) return null;
  const isToday = day.hasSame(DateTime.now().setZone(TZ), "day");
  return (
    <div className="w-28 shrink-0 sm:w-36">
      <Column
        narrow
        day={day}
        pro={merged}
        label={`${WEEKDAYS_SHORT[day.weekday % 7]} ${day.toFormat("d/M")}${isToday ? " ·" : ""}`}
        appts={appts}
        blocks={blocks}
        customer={(a) => `${pros.length > 1 ? `${pros.find((p) => p.id === a.professionalId)?.name[0] ?? ""}· ` : ""}${customer(a)}`}
        onBlock={onBlock}
      />
    </div>
  );
}

function ManualBookingSheet({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate: string }) {
  const { db, business: b, isStaff, pros } = useBiz();
  const services = db.services.filter((s) => s.businessId === b.id && s.active);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [proId, setProId] = useState(pros[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const eligible = pros.filter((p) => p.serviceIds.includes(serviceId));
  const slots = useMemo(() => (serviceId && proId ? getSlots(db, { businessId: b.id, serviceId, date, professionalId: proId, ignoreLead: true }) : []), [db, b.id, serviceId, proId, date]);
  return (
    <Sheet open={open} onClose={onClose} title="תור ידני (טלפון / הגעה)" wide>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!start) return toast("error", "בחרו שעה פנויה");
          if (createManualAppointment({ serviceId, professionalId: proId, start, guestName: name, guestPhone: phone || undefined, note: note || undefined })) {
            toast("ok", "התור נוסף ליומן");
            setName("");
            setPhone("");
            setStart("");
            onClose();
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם הלקוח/ה" htmlFor="mb-name">
            <Input id="mb-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="טלפון (לא חובה)" htmlFor="mb-phone">
            <Input id="mb-phone" dir="ltr" className="text-start" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="שירות" htmlFor="mb-svc">
            <Select
              id="mb-svc"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setStart("");
                if (!pros.find((p) => p.id === proId)?.serviceIds.includes(e.target.value)) setProId(pros.find((p) => p.serviceIds.includes(e.target.value))?.id ?? "");
              }}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="איש צוות" htmlFor="mb-pro">
            <Select id="mb-pro" value={proId} disabled={isStaff} onChange={(e) => (setProId(e.target.value), setStart(""))}>
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="תאריך" htmlFor="mb-date">
            <Input id="mb-date" type="date" value={date} onChange={(e) => (setDate(e.target.value), setStart(""))} />
          </Field>
          <Field label="שעה פנויה" htmlFor="mb-time" hint={slots.length ? `${slots.length} מועדים פנויים` : "אין מועדים פנויים ביום הזה"}>
            <Select id="mb-time" value={start} onChange={(e) => setStart(e.target.value)}>
              <option value="">בחירה</option>
              {slots.map((s) => (
                <option key={s.start} value={s.start}>
                  {fmtTime(s.start)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="הערה פנימית (לא חובה)" htmlFor="mb-note">
          <Input id="mb-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">רק מועדים פנויים מוצגים — המערכת מונעת חפיפה עם תורים, הפסקות וחסימות. בדמו לא נשלחת הודעה ללקוח/ה.</p>
        <Button type="submit" size="lg">
          הוספה ליומן
        </Button>
      </form>
    </Sheet>
  );
}

function BlockTimeSheet({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate: string }) {
  const { pros, isStaff } = useBiz();
  const [proId, setProId] = useState(pros[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [from, setFrom] = useState("13:00");
  const [to, setTo] = useState("14:00");
  const [reason, setReason] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="חסימת זמן ביומן">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const day = DateTime.fromISO(date, { zone: TZ });
          const s = atMinute(day, hhmmToMin(from)).toISO()!;
          const en = atMinute(day, hhmmToMin(to)).toISO()!;
          if (!reason.trim()) return toast("error", "נא לציין סיבה (למשל: חופשה, הדרכה)");
          if (addBlockedTime({ professionalId: proId, start: new Date(s).toISOString(), end: new Date(en).toISOString(), reason: reason.trim() })) {
            toast("ok", `הזמן נחסם — ${minToHHMM(hhmmToMin(from))}–${minToHHMM(hhmmToMin(to))}`);
            setReason("");
            onClose();
          }
        }}
      >
        <Field label="איש צוות" htmlFor="bt-pro">
          <Select id="bt-pro" value={proId} disabled={isStaff} onChange={(e) => setProId(e.target.value)}>
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="תאריך" htmlFor="bt-date">
          <Input id="bt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מ־" htmlFor="bt-from">
            <Input id="bt-from" type="time" step={900} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="עד" htmlFor="bt-to">
            <Input id="bt-to" type="time" step={900} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="סיבה" htmlFor="bt-reason">
          <Input id="bt-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="חופשה, הדרכה, סידורים…" />
        </Field>
        <p className="text-xs text-muted">תורים קיימים לא מבוטלים אוטומטית — רק מועדים חדשים ייחסמו.</p>
        <Button type="submit" size="lg">
          חסימה
        </Button>
      </form>
    </Sheet>
  );
}
