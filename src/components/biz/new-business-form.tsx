"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@prisma/client";
import { apiFetch } from "@/lib/client";
import { CITIES } from "@/lib/constants";
import { Button, Field, Input, Select, Textarea } from "../ui";
import { InterestPicker } from "../area-interests";

export function NewBusinessForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", city: "", address: "", phone: "", description: "", ownerIsStaff: true });
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/biz", { body: { ...f, categories: cats } });
      router.push("/biz");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="שם העסק" id="nb-name">
        <Input id="nb-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </Field>
      <div>
        <span className="mb-2 block text-sm font-medium text-ink-2">תחומים</span>
        <InterestPicker value={cats} onChange={setCats} />
      </div>
      <Field label="עיר" id="nb-city">
        <Select id="nb-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
          <option value="">בחרו עיר</option>
          {CITIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="כתובת" id="nb-addr">
        <Input id="nb-addr" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </Field>
      <Field label="טלפון העסק" id="nb-phone">
        <Input id="nb-phone" type="tel" dir="ltr" className="text-start" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      <Field label="תיאור קצר" id="nb-desc">
        <Textarea id="nb-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--color-ink)]" checked={f.ownerIsStaff} onChange={(e) => setF({ ...f, ownerIsStaff: e.target.checked })} />
        גם אני מקבל/ת לקוחות (ייווצר לי יומן)
      </label>
      {error && <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      <Button type="submit" size="lg" loading={busy}>
        יצירת העסק
      </Button>
    </form>
  );
}
