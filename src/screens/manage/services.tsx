import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { CategoryId, Service } from "../../domain/types";
import { CATEGORIES, duration, price } from "../../domain/format";
import { depositFor } from "../../domain/booking";
import { upsertService } from "../../store/actions";
import { toast } from "../../store/app";
import { Badge, Button, Field, Input, Segmented, Select, Textarea, Toggle } from "../../ui/kit";
import { Sheet } from "../../ui/overlays";
import { Page, TopBar } from "../../ui/shell";
import { useBiz } from "./common";

export function ServicesScreen() {
  const { db, business: b } = useBiz();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const services = db.services.filter((s) => s.businessId === b.id);
  return (
    <>
      <TopBar
        title="שירותים ומחירים"
        back="/manage"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> שירות
          </Button>
        }
      />
      <Page className="max-w-3xl">
        <p className="mb-4 text-sm text-muted">לכל שירות קובעים משך, מרווח, מחיר, אישור (מיידי או ידני) ותשלום (בעסק או מקדמה). שינוי מחיר משפיע רק על הזמנות חדשות — תורים קיימים שומרים את המחיר שבו הוזמנו.</p>
        <ul className="flex flex-col gap-2">
          {services.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setEditing(s)} className="flex w-full items-start gap-3 rounded-2xl border border-line p-4 text-start hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-bold">
                    {s.name} {!s.active && <Badge tone="outline">לא פעיל</Badge>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge>{duration(s.durationMin)}{s.bufferMin ? ` + ${s.bufferMin} דק׳ מרווח` : ""}</Badge>
                    <Badge tone={s.approval === "manual" ? "warn" : "ok"}>{s.approval === "manual" ? "אישור ידני" : "אישור מיידי"}</Badge>
                    <Badge tone={s.payment === "deposit" ? "info" : "neutral"}>{s.payment === "deposit" ? `מקדמה ${s.deposit.type === "percent" ? `${s.deposit.value}%` : price(s.deposit.value)}` : "תשלום בעסק"}</Badge>
                  </div>
                </div>
                <span className="num font-bold">{price(s.price, s.priceFrom)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Page>
      <ServiceSheet value={editing} onClose={() => setEditing(null)} defaultCategory={b.categories[0]} />
    </>
  );
}

function ServiceSheet({ value, onClose, defaultCategory }: { value: Service | "new" | null; onClose: () => void; defaultCategory: CategoryId }) {
  type Form = Omit<Service, "id" | "businessId"> & { id?: string };
  const blank: Form = { name: "", description: "", category: defaultCategory, durationMin: 60, bufferMin: 10, price: 200, priceFrom: false, approval: "auto", payment: "at_business", deposit: { type: "fixed", value: 50 }, active: true };
  const [f, setF] = useState<Form>(blank);
  useEffect(() => {
    if (value) setF(value === "new" ? blank : { ...value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const preview = depositFor(f as Service);
  return (
    <Sheet open={!!value} onClose={onClose} title={value === "new" ? "שירות חדש" : "עריכת שירות"} wide>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (upsertService(f) !== undefined) {
            toast("ok", "השירות נשמר");
            onClose();
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם השירות" htmlFor="sv-name">
            <Input id="sv-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="קטגוריה" htmlFor="sv-cat">
            <Select id="sv-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as CategoryId })}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="תיאור" htmlFor="sv-desc">
          <Textarea id="sv-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={200} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="משך (דק׳)" htmlFor="sv-dur">
            <Input id="sv-dur" type="number" min={5} step={5} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} />
          </Field>
          <Field label="מרווח (דק׳)" htmlFor="sv-buf" hint="ניקיון והכנה">
            <Input id="sv-buf" type="number" min={0} step={5} value={f.bufferMin} onChange={(e) => setF({ ...f, bufferMin: Number(e.target.value) })} />
          </Field>
          <Field label="מחיר (₪)" htmlFor="sv-price">
            <Input id="sv-price" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
          </Field>
        </div>
        <Toggle id="sv-from" label="מחיר ״החל מ־״" description="המחיר הסופי נקבע בעסק" checked={f.priceFrom} onChange={(priceFrom) => setF({ ...f, priceFrom })} />
        <div>
          <div className="mb-2 text-sm font-semibold">אישור הזמנה</div>
          <Segmented
            label="אישור הזמנה"
            value={f.approval}
            onChange={(approval) => setF({ ...f, approval })}
            options={[
              { value: "auto", label: "מיידי" },
              { value: "manual", label: "באישור העסק" },
            ]}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold">תשלום</div>
          <Segmented
            label="תשלום"
            value={f.payment}
            onChange={(payment) => setF({ ...f, payment })}
            options={[
              { value: "at_business", label: "בעסק" },
              { value: "deposit", label: "מקדמה מראש (דמו)" },
            ]}
          />
        </div>
        {f.payment === "deposit" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="סוג מקדמה" htmlFor="sv-dt">
              <Select id="sv-dt" value={f.deposit.type} onChange={(e) => setF({ ...f, deposit: { ...f.deposit, type: e.target.value as "fixed" | "percent" } })}>
                <option value="fixed">סכום קבוע</option>
                <option value="percent">אחוז מהמחיר</option>
              </Select>
            </Field>
            <Field label={f.deposit.type === "fixed" ? "סכום (₪)" : "אחוז"} htmlFor="sv-dv" hint={`ללקוח/ה: ${price(preview)} עכשיו, ${price(Math.max(0, f.price - preview))} בעסק`}>
              <Input id="sv-dv" type="number" min={1} value={f.deposit.value} onChange={(e) => setF({ ...f, deposit: { ...f.deposit, value: Number(e.target.value) } })} />
            </Field>
          </div>
        )}
        <Toggle id="sv-active" label="פעיל" description="שירות לא פעיל לא מוצג ללקוחות" checked={f.active} onChange={(active) => setF({ ...f, active })} />
        <Button type="submit" size="lg">
          שמירה
        </Button>
      </form>
    </Sheet>
  );
}
