import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Professional, WorkingRange } from "../../domain/types";
import { WEEKDAYS } from "../../domain/format";
import { hhmmToMin, minToHHMM } from "../../domain/time";
import { upsertProfessional } from "../../store/actions";
import { toast } from "../../store/app";
import { Avatar, Badge, Button, Field, Input, Toggle } from "../../ui/kit";
import { Sheet } from "../../ui/overlays";
import { Page, TopBar } from "../../ui/shell";
import { useBiz } from "./common";

export function StaffScreen() {
  const { db, business: b } = useBiz();
  const [editing, setEditing] = useState<Professional | "new" | null>(null);
  const pros = db.professionals.filter((p) => p.businessId === b.id);
  return (
    <>
      <TopBar
        title="צוות"
        back="/manage"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> איש צוות
          </Button>
        }
      />
      <Page className="max-w-3xl">
        <p className="mb-4 text-sm text-muted">שעות העבודה וההפסקות של כל איש צוות קובעות את המועדים שלקוחות רואים.</p>
        <ul className="flex flex-col gap-2">
          {pros.map((p) => {
            const login = db.users.find((u) => u.professionalId === p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => setEditing(p)} className="flex w-full items-center gap-3 rounded-2xl border border-line p-4 text-start hover:bg-surface">
                  <Avatar src={p.avatar} name={p.name} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-bold">
                      {p.name}
                      {!p.active && <Badge tone="outline">לא פעיל</Badge>}
                      {login && <Badge tone="info">גישת צוות</Badge>}
                    </div>
                    <div className="text-sm text-muted">{p.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {p.serviceIds.length} שירותים · {new Set(p.workingHours.map((h) => h.weekday)).size} ימי עבודה{p.breaks.length ? ` · ${p.breaks.length} הפסקות` : ""}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Page>
      <ProSheet value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function ProSheet({ value, onClose }: { value: Professional | "new" | null; onClose: () => void }) {
  const { db, business: b } = useBiz();
  const services = db.services.filter((s) => s.businessId === b.id);
  const blank = { name: "", title: "", specialties: [] as string[], serviceIds: [] as string[], workingHours: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, start: 540, end: 1080 })), breaks: [] as WorkingRange[], active: true };
  const [f, setF] = useState<Partial<Professional> & typeof blank>(blank);
  const [spec, setSpec] = useState("");
  useEffect(() => {
    if (value) {
      const v = value === "new" ? blank : { ...value };
      setF(v);
      setSpec(v.specialties.join(", "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const setDay = (wd: number, on: boolean) =>
    setF({ ...f, workingHours: on ? [...f.workingHours, { weekday: wd, start: 540, end: 1080 }] : f.workingHours.filter((h) => h.weekday !== wd), breaks: on ? f.breaks : f.breaks.filter((x) => x.weekday !== wd) });
  const patchRange = (key: "workingHours" | "breaks", idx: number, patch: Partial<WorkingRange>) => setF({ ...f, [key]: f[key].map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  return (
    <Sheet open={!!value} onClose={onClose} title={value === "new" ? "איש צוות חדש" : `עריכת ${f.name}`} wide>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (upsertProfessional({ ...f, specialties: spec.split(",").map((s) => s.trim()).filter(Boolean) }) !== undefined) {
            toast("ok", "נשמר");
            onClose();
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם" htmlFor="pr-name">
            <Input id="pr-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="תפקיד" htmlFor="pr-title">
            <Input id="pr-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="למשל: מעצבת שיער בכירה" />
          </Field>
        </div>
        <Field label="התמחויות" htmlFor="pr-spec" hint="מופרדות בפסיק">
          <Input id="pr-spec" value={spec} onChange={(e) => setSpec(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">שירותים</legend>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => {
              const on = f.serviceIds.includes(s.id);
              return (
                <label key={s.id} className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-surface">
                  <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={on} onChange={() => setF({ ...f, serviceIds: on ? f.serviceIds.filter((x) => x !== s.id) : [...f.serviceIds, s.id] })} />
                  {s.name}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">שעות עבודה והפסקות</legend>
          <div className="flex flex-col divide-y divide-line rounded-2xl border border-line px-3">
            {WEEKDAYS.map((name, wd) => {
              const ranges = f.workingHours.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === wd);
              const brks = f.breaks.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === wd);
              return (
                <div key={wd} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center gap-3">
                    <label className="flex w-24 items-center gap-2 font-medium">
                      <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={ranges.length > 0} onChange={(e) => setDay(wd, e.target.checked)} />
                      {name}
                    </label>
                    {ranges.length === 0 && <span className="text-sm text-muted">לא עובד/ת</span>}
                    {ranges.map(({ r, i }) => (
                      <span key={i} className="flex items-center gap-1">
                        <TimeInput label={`${name} התחלה`} value={r.start} onChange={(v) => patchRange("workingHours", i, { start: v })} />
                        <span aria-hidden>–</span>
                        <TimeInput label={`${name} סיום`} value={r.end} onChange={(v) => patchRange("workingHours", i, { end: v })} />
                      </span>
                    ))}
                    {ranges.length > 0 && (
                      <button type="button" className="ms-auto text-xs font-semibold underline" onClick={() => setF({ ...f, breaks: [...f.breaks, { weekday: wd, start: 780, end: 810 }] })}>
                        + הפסקה
                      </button>
                    )}
                  </div>
                  {brks.map(({ r, i }) => (
                    <div key={i} className="flex items-center gap-1 ps-24 text-sm">
                      <span className="text-muted">הפסקה</span>
                      <TimeInput label={`הפסקה ${name} התחלה`} value={r.start} onChange={(v) => patchRange("breaks", i, { start: v })} />
                      <span aria-hidden>–</span>
                      <TimeInput label={`הפסקה ${name} סיום`} value={r.end} onChange={(v) => patchRange("breaks", i, { end: v })} />
                      <button type="button" aria-label="הסרת הפסקה" className="grid size-8 place-items-center rounded-full hover:bg-surface" onClick={() => setF({ ...f, breaks: f.breaks.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </fieldset>
        <Toggle id="pr-active" label="פעיל/ה" description="איש צוות לא פעיל לא מוצג ולא מקבל הזמנות" checked={f.active} onChange={(active) => setF({ ...f, active })} />
        <Button type="submit" size="lg">
          שמירה
        </Button>
      </form>
    </Sheet>
  );
}

function TimeInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return <input type="time" step={900} aria-label={label} value={minToHHMM(value)} onChange={(e) => e.target.value && onChange(hhmmToMin(e.target.value))} className="num h-9 rounded-xl border border-line bg-bg px-2 text-sm" />;
}
