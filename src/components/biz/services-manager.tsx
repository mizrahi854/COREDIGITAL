"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Plus } from "lucide-react";
import type { Category } from "@prisma/client";
import { apiFetch } from "@/lib/client";
import { CATEGORIES } from "@/lib/constants";
import { formatDuration, formatPrice } from "@/lib/format";
import { Badge, Button, Card, Chip, EmptyState, Field, Input, Select, Textarea } from "../ui";
import { Sheet } from "../sheet";
import { useToast } from "../toast";

type Svc = {
  id: string;
  name: string;
  description: string;
  category: Category;
  styleTags: string[];
  mode: "FIXED" | "CONSULTATION";
  priceAgorot: number;
  durationMin: number;
  bufferMin: number;
  active: boolean;
  staffIds: string[];
};

export function ServicesManager({ services, staff, defaultCategory }: { services: Svc[]; staff: { id: string; name: string }[]; defaultCategory: Category }) {
  const router = useRouter();
  const toast = useToast();
  const blank: Svc = { id: "", name: "", description: "", category: defaultCategory, styleTags: [], mode: "FIXED", priceAgorot: 0, durationMin: 60, bufferMin: 10, active: true, staffIds: staff.map((s) => s.id) };
  const [edit, setEdit] = useState<Svc | null>(null);
  const [price, setPrice] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (s: Svc) => {
    setEdit(s);
    setPrice(s.id ? String(s.priceAgorot / 100) : "");
    setTags(s.styleTags.join(", "));
    setError(null);
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: edit.name,
        description: edit.description,
        category: edit.category,
        styleTags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
        mode: edit.mode,
        priceAgorot: Math.round(Number(price || 0) * 100),
        durationMin: edit.durationMin,
        bufferMin: edit.bufferMin,
        active: edit.active,
        staffIds: edit.staffIds,
      };
      if (edit.id) await apiFetch(`/api/biz/services/${edit.id}`, { method: "PUT", body });
      else await apiFetch("/api/biz/services", { body });
      toast({ kind: "ok", text: edit.id ? "השירות עודכן. תורים קיימים שומרים על המחיר והמשך שסוכמו." : "השירות נוסף" });
      setEdit(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">שירותים ומחירים</h1>
          <p className="text-sm text-muted">שינוי מחיר או משך לא משנה תורים שכבר נקבעו.</p>
        </div>
        <Button onClick={() => open(blank)}>
          <Plus className="size-4" aria-hidden /> שירות חדש
        </Button>
      </div>
      {services.length === 0 ? (
        <EmptyState title="עוד אין שירותים" text="הוסיפו שירות עם מחיר, משך וזמן הכנה כדי שלקוחות יוכלו לקבוע." action={<Button onClick={() => open(blank)}>הוספת שירות</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {services.map((s) => (
            <li key={s.id}>
              <Card className={`flex items-start gap-3 p-4 ${s.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{s.name}</h2>
                    {s.mode === "CONSULTATION" && <Badge tone="warn">בתיאום מחיר</Badge>}
                    {!s.active && <Badge>לא פעיל</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                    <span className="ltr-nums font-semibold text-ink">{formatPrice(s.priceAgorot, { from: s.mode === "CONSULTATION" })}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden /> {formatDuration(s.durationMin)}
                    </span>
                    {s.bufferMin > 0 && <span>+{s.bufferMin} דק׳ הכנה</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">{s.staffIds.length ? staff.filter((x) => s.staffIds.includes(x.id)).map((x) => x.name).join(", ") : "אין צוות משויך — לא ניתן להזמין"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => open(s)} aria-label={`עריכת ${s.name}`}>
                  <Pencil className="size-4" aria-hidden /> עריכה
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "עריכת שירות" : "שירות חדש"} className="md:max-w-xl">
        {edit && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label="שם השירות" id="s-name">
              <Input id="s-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            </Field>
            <Field label="תיאור" id="s-desc">
              <Textarea id="s-desc" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="קטגוריה" id="s-cat">
                <Select id="s-cat" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as Category })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="תמחור" id="s-mode">
                <Select id="s-mode" value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value as Svc["mode"] })}>
                  <option value="FIXED">מחיר קבוע — אישור אוטומטי</option>
                  <option value="CONSULTATION">בתיאום — דורש הצעה ואישור</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label={edit.mode === "CONSULTATION" ? "החל מ־ (₪)" : "מחיר (₪)"} id="s-price">
                <Input id="s-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} required />
              </Field>
              <Field label="משך (דק׳)" id="s-dur">
                <Input id="s-dur" inputMode="numeric" value={edit.durationMin} onChange={(e) => setEdit({ ...edit, durationMin: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
              <Field label="הכנה (דק׳)" id="s-buf">
                <Input id="s-buf" inputMode="numeric" value={edit.bufferMin} onChange={(e) => setEdit({ ...edit, bufferMin: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
            </div>
            <Field label="תגיות סגנון" id="s-tags" hint="מופרדות בפסיק — עוזרות למצוא אתכם בחיפוש">
              <Input id="s-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="נוד, ג׳ל, מינימליסטי" />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-2">מי מבצע/ת את השירות</legend>
              <div className="flex flex-wrap gap-2">
                {staff.map((st) => {
                  const on = edit.staffIds.includes(st.id);
                  return (
                    <Chip key={st.id} active={on} onClick={() => setEdit({ ...edit, staffIds: on ? edit.staffIds.filter((x) => x !== st.id) : [...edit.staffIds, st.id] })}>
                      {st.name}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 accent-[var(--color-ink)]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              פעיל — מוצג ללקוחות וניתן להזמנה
            </label>
            {error && <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
            <Button type="submit" size="lg" loading={busy}>
              שמירה
            </Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
