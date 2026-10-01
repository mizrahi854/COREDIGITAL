"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { CalendarOff, Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { WEEKDAYS_HE, WEEKDAYS_SHORT } from "@/lib/constants";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/format";
import { Avatar, Badge, Button, Card, Chip, Field, Input } from "../ui";
import { Sheet } from "../sheet";
import { useToast } from "../toast";

type Range = { weekday: number; startMin: number; endMin: number };
type Member = {
  id: string;
  name: string;
  title: string;
  active: boolean;
  avatarUrl: string | null;
  email: string | null;
  serviceIds: string[];
  workingHours: Range[];
  breaks: (Range & { label: string })[];
  timeOff: { id: string; startsAt: string; endsAt: string; reason: string }[];
};

type DayRow = { on: boolean; start: string; end: string; brk: boolean; bStart: string; bEnd: string };

function toRows(m: Member): DayRow[] {
  return WEEKDAYS_HE.map((_, d) => {
    const w = m.workingHours.find((x) => x.weekday === d);
    const b = m.breaks.find((x) => x.weekday === d);
    return {
      on: !!w,
      start: minutesToHHMM(w?.startMin ?? 540),
      end: minutesToHHMM(w?.endMin ?? 1080),
      brk: !!b,
      bStart: minutesToHHMM(b?.startMin ?? 780),
      bEnd: minutesToHHMM(b?.endMin ?? 810),
    };
  });
}

export function TeamManager({ staff, services, timezone }: { staff: Member[]; services: { id: string; name: string }[]; timezone: string }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<Member | null>(null);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: "", title: "", email: "" });
  const [off, setOff] = useState<Member | null>(null);
  const [offForm, setOffForm] = useState({ from: "", fromTime: "00:00", to: "", toTime: "23:59", reason: "" });

  const open = (m: Member) => {
    setEdit(m);
    setRows(toRows(m));
    setError(null);
  };

  const save = async () => {
    if (!edit) return;
    setBusy("save");
    setError(null);
    try {
      await apiFetch(`/api/biz/staff/${edit.id}`, {
        method: "PUT",
        body: {
          name: edit.name,
          title: edit.title,
          active: edit.active,
          serviceIds: edit.serviceIds,
          workingHours: rows.flatMap((r, d) => (r.on ? [{ weekday: d, startMin: hhmmToMinutes(r.start), endMin: hhmmToMinutes(r.end) }] : [])),
          breaks: rows.flatMap((r, d) => (r.on && r.brk ? [{ weekday: d, startMin: hhmmToMinutes(r.bStart), endMin: hhmmToMinutes(r.bEnd), label: "הפסקה" }] : [])),
        },
      });
      toast({ kind: "ok", text: "נשמר. הזמינות מתעדכנת מיד." });
      setEdit(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    setBusy("add");
    try {
      await apiFetch("/api/biz/staff", { body: newStaff });
      setAdding(false);
      setNewStaff({ name: "", title: "", email: "" });
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const addTimeOff = async () => {
    if (!off) return;
    setBusy("off");
    try {
      const startsAt = DateTime.fromISO(`${offForm.from}T${offForm.fromTime}`, { zone: timezone });
      const endsAt = DateTime.fromISO(`${offForm.to || offForm.from}T${offForm.toTime}`, { zone: timezone });
      const r = await apiFetch<{ conflictingAppointments: number }>(`/api/biz/staff/${off.id}/timeoff`, {
        body: { startsAt: startsAt.toUTC().toISO(), endsAt: endsAt.toUTC().toISO(), reason: offForm.reason },
      });
      toast({
        kind: r.conflictingAppointments ? "info" : "ok",
        text: r.conflictingAppointments ? `החופשה נשמרה. שימו לב: ${r.conflictingAppointments} תורים קיימים בטווח — יש לטפל בהם ביומן.` : "החופשה נשמרה והמועדים נחסמו",
      });
      setOff(null);
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const removeTimeOff = async (staffId: string, id: string) => {
    await apiFetch(`/api/biz/staff/${staffId}/timeoff?timeOffId=${id}`, { method: "DELETE" }).catch((e) => toast({ kind: "error", text: e.message }));
    router.refresh();
  };

  const uploadAvatar = async (staffId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "staff");
    form.set("staffId", staffId);
    try {
      await apiFetch("/api/biz/images", { form });
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    }
  };

  const setRow = (d: number, patch: Partial<DayRow>) => setRows((all) => all.map((r, i) => (i === d ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">צוות ושעות עבודה</h1>
          <p className="text-sm text-muted">הזמינות ללקוחות מחושבת מהשעות, ההפסקות, החופשות והתורים הקיימים.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> איש צוות
        </Button>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {staff.map((m) => (
          <li key={m.id}>
            <Card className={`flex flex-col gap-4 p-5 ${m.active ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <label className="relative cursor-pointer" aria-label={`החלפת תמונה של ${m.name}`}>
                  <Avatar src={m.avatarUrl} name={m.name} size={52} />
                  <span className="absolute -bottom-1 -end-1 grid size-6 place-items-center rounded-full bg-ink text-cream">
                    <Camera className="size-3.5" aria-hidden />
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadAvatar(m.id, e.target.files[0])} />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {m.name} {!m.active && <Badge>לא פעיל/ה</Badge>}
                  </div>
                  <div className="text-sm text-muted">{m.title}</div>
                  {m.email && <div className="ltr-nums text-xs text-muted">גישת צוות: {m.email}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => open(m)}>
                  <Pencil className="size-4" aria-hidden /> עריכה
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {WEEKDAYS_HE.map((d, i) => {
                  const w = m.workingHours.filter((x) => x.weekday === i);
                  return (
                    <div key={d} className={`rounded-xl px-0.5 py-2 ${w.length ? "bg-bronze-soft/60" : "bg-sand/50 text-muted"}`}>
                      <div className="font-semibold">{WEEKDAYS_SHORT[i]}</div>
                      {w.length ? (
                        w.map((x, k) => (
                          <div key={k} className="ltr-nums">
                            {minutesToHHMM(x.startMin)}
                            <br />
                            {minutesToHHMM(x.endMin)}
                          </div>
                        ))
                      ) : (
                        <div>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">חופשות והיעדרויות</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setOff(m);
                      setOffForm({ from: DateTime.now().setZone(timezone).toISODate()!, fromTime: "00:00", to: "", toTime: "23:59", reason: "" });
                    }}
                  >
                    <CalendarOff className="size-4" aria-hidden /> הוספה
                  </Button>
                </div>
                {m.timeOff.length === 0 ? (
                  <p className="text-xs text-muted">אין חופשות מתוכננות.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {m.timeOff.map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded-xl bg-sand/50 px-3 py-2 text-sm">
                        <span>
                          {DateTime.fromISO(t.startsAt).setZone(timezone).setLocale("he").toFormat("d/M HH:mm")} – {DateTime.fromISO(t.endsAt).setZone(timezone).setLocale("he").toFormat("d/M HH:mm")}
                          {t.reason && <span className="text-muted"> · {t.reason}</span>}
                        </span>
                        <button onClick={() => removeTimeOff(m.id, t.id)} className="grid size-8 place-items-center rounded-full hover:bg-sand-2" aria-label="מחיקת חופשה">
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={`עריכת ${edit?.name ?? ""}`} className="md:max-w-2xl">
        {edit && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם" id="t-name">
                <Input id="t-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="תפקיד" id="t-title">
                <Input id="t-title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">שירותים שמבצע/ת</legend>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = edit.serviceIds.includes(s.id);
                  return (
                    <Chip key={s.id} active={on} onClick={() => setEdit({ ...edit, serviceIds: on ? edit.serviceIds.filter((x) => x !== s.id) : [...edit.serviceIds, s.id] })}>
                      {s.name}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">שעות עבודה שבועיות (שעון ישראל)</legend>
              <div className="flex flex-col gap-2">
                {rows.map((r, d) => (
                  <div key={d} className="flex flex-wrap items-center gap-2 rounded-2xl bg-paper p-2 ps-3">
                    <label className="flex w-20 items-center gap-2 text-sm font-medium">
                      <input type="checkbox" className="size-4 accent-[var(--color-ink)]" checked={r.on} onChange={(e) => setRow(d, { on: e.target.checked })} />
                      {WEEKDAYS_HE[d]}
                    </label>
                    {r.on ? (
                      <>
                        <Input type="time" className="h-10 w-28" aria-label={`התחלה ${WEEKDAYS_HE[d]}`} value={r.start} onChange={(e) => setRow(d, { start: e.target.value })} />
                        <span aria-hidden>–</span>
                        <Input type="time" className="h-10 w-28" aria-label={`סיום ${WEEKDAYS_HE[d]}`} value={r.end} onChange={(e) => setRow(d, { end: e.target.value })} />
                        <label className="ms-2 flex items-center gap-1.5 text-xs text-muted">
                          <input type="checkbox" className="size-4 accent-[var(--color-ink)]" checked={r.brk} onChange={(e) => setRow(d, { brk: e.target.checked })} />
                          הפסקה
                        </label>
                        {r.brk && (
                          <>
                            <Input type="time" className="h-10 w-28" aria-label={`תחילת הפסקה ${WEEKDAYS_HE[d]}`} value={r.bStart} onChange={(e) => setRow(d, { bStart: e.target.value })} />
                            <span aria-hidden>–</span>
                            <Input type="time" className="h-10 w-28" aria-label={`סוף הפסקה ${WEEKDAYS_HE[d]}`} value={r.bEnd} onChange={(e) => setRow(d, { bEnd: e.target.value })} />
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted">לא עובד/ת</span>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 accent-[var(--color-ink)]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              פעיל/ה — מופיע/ה בהזמנות
            </label>
            {error && <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
            <Button size="lg" onClick={save} loading={busy === "save"}>
              שמירה
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="איש צוות חדש">
        <div className="flex flex-col gap-4">
          <Field label="שם" id="n-name">
            <Input id="n-name" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
          </Field>
          <Field label="תפקיד" id="n-title">
            <Input id="n-title" value={newStaff.title} onChange={(e) => setNewStaff({ ...newStaff, title: e.target.value })} />
          </Field>
          <Field label="אימייל לגישת צוות (לא חובה)" id="n-email" hint="אם לאדם יש חשבון BUBER, הוא יקבל גישה ליומן שלו בלבד.">
            <Input id="n-email" type="email" dir="ltr" className="text-start" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} />
          </Field>
          <Button size="lg" onClick={add} loading={busy === "add"} disabled={newStaff.name.trim().length < 2}>
            הוספה
          </Button>
          <p className="text-xs text-muted">ברירת מחדל: א׳–ה׳ 09:00–18:00. אפשר לערוך אחרי ההוספה.</p>
        </div>
      </Sheet>

      <Sheet open={!!off} onClose={() => setOff(null)} title={`חופשה / היעדרות — ${off?.name ?? ""}`}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="מתאריך" id="o-from">
              <Input id="o-from" type="date" value={offForm.from} onChange={(e) => setOffForm({ ...offForm, from: e.target.value })} />
            </Field>
            <Field label="משעה" id="o-ft">
              <Input id="o-ft" type="time" value={offForm.fromTime} onChange={(e) => setOffForm({ ...offForm, fromTime: e.target.value })} />
            </Field>
            <Field label="עד תאריך" id="o-to">
              <Input id="o-to" type="date" value={offForm.to} min={offForm.from} onChange={(e) => setOffForm({ ...offForm, to: e.target.value })} />
            </Field>
            <Field label="עד שעה" id="o-tt">
              <Input id="o-tt" type="time" value={offForm.toTime} onChange={(e) => setOffForm({ ...offForm, toTime: e.target.value })} />
            </Field>
          </div>
          <Field label="סיבה (לא חובה)" id="o-r">
            <Input id="o-r" value={offForm.reason} onChange={(e) => setOffForm({ ...offForm, reason: e.target.value })} placeholder="חופשה, השתלמות…" />
          </Field>
          <Button size="lg" onClick={addTimeOff} loading={busy === "off"} disabled={!offForm.from}>
            שמירה
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
