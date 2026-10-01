"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, ShieldCheck, Store } from "lucide-react";
import type { Category } from "@prisma/client";
import { apiFetch } from "@/lib/client";
import { AreaPicker, InterestPicker, type AreaValue } from "./area-interests";
import { Avatar, Badge, Button, Card, Field, Input } from "./ui";
import { useToast } from "./toast";

export function ProfileView({
  user,
  businesses,
  blocked,
  following,
}: {
  user: { name: string; email: string; phone: string | null; isAdmin: boolean; interests: Category[] } & AreaValue;
  businesses: { id: string; name: string; slug: string; role: string; status: string }[];
  blocked: { id: string; name: string }[];
  following: { id: string; name: string; slug: string; avatarUrl: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [area, setArea] = useState<AreaValue>({ city: user.city, lat: user.lat, lng: user.lng });
  const [interests, setInterests] = useState(user.interests);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/me", { method: "PATCH", body: { name, phone: phone || null, ...area, interests } });
      toast({ kind: "ok", text: "הפרופיל נשמר" });
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const switchToBusiness = async (id: string) => {
    await apiFetch("/api/auth/mode", { body: { mode: "business", businessId: id } });
    router.push("/biz");
    router.refresh();
  };
  const logout = async () => {
    await apiFetch("/api/auth/logout", { body: {} });
    router.push("/");
    router.refresh();
  };
  const unblock = async (id: string) => {
    await apiFetch("/api/social", { body: { action: "block", targetId: id, on: false } });
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:pt-10">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={user.name} size={64} />
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="ltr-nums text-start text-sm text-muted">{user.email}</p>
        </div>
      </div>

      {/* Mode switching: one account, customer + business roles */}
      <Card className="mb-6 flex flex-col gap-2 p-4">
        <h2 className="px-1 text-sm font-semibold text-muted">מצבי חשבון</h2>
        {businesses.map((b) => (
          <button key={b.id} onClick={() => switchToBusiness(b.id)} className="flex h-14 items-center gap-3 rounded-2xl px-3 text-start hover:bg-sand">
            <Store className="size-5 text-bronze-ink" aria-hidden />
            <span className="flex-1">
              <span className="block font-semibold">ניהול {b.name}</span>
              <span className="text-xs text-muted">{b.role === "OWNER" ? "בעלים" : "צוות"}{b.status !== "APPROVED" ? " · ממתין לאישור" : ""}</span>
            </span>
            <ChevronLeft className="size-5 text-muted" aria-hidden />
          </button>
        ))}
        {businesses.length === 0 && (
          <Link href="/biz/new" className="flex h-14 items-center gap-3 rounded-2xl px-3 hover:bg-sand">
            <Store className="size-5 text-bronze-ink" aria-hidden />
            <span className="flex-1 font-semibold">יש לך עסק? פתיחת פרופיל עסקי</span>
            <ChevronLeft className="size-5 text-muted" aria-hidden />
          </Link>
        )}
        {user.isAdmin && (
          <Link href="/admin" className="flex h-14 items-center gap-3 rounded-2xl px-3 hover:bg-sand">
            <ShieldCheck className="size-5 text-bronze-ink" aria-hidden />
            <span className="flex-1 font-semibold">ניהול מערכת</span>
            <ChevronLeft className="size-5 text-muted" aria-hidden />
          </Link>
        )}
      </Card>

      <section className="mb-8 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">פרטים אישיים</h2>
        <Field label="שם" id="pname">
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="טלפון" id="pphone">
          <Input id="pphone" type="tel" dir="ltr" className="text-start" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </section>
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">אזור</h2>
        <AreaPicker value={area} onChange={setArea} />
      </section>
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">תחומי עניין</h2>
        <InterestPicker value={interests} onChange={setInterests} />
        <p className="mt-2 text-xs text-muted">הפיד מסודר לפי: עסקים שאת/ה עוקב/ת, האזור שלך, תחומי העניין וכמה הסרטון חדש.</p>
      </section>
      <Button size="lg" className="mb-10 w-full" onClick={save} loading={busy}>
        שמירת שינויים
      </Button>

      {following.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">עוקב/ת אחרי</h2>
          <ul className="flex flex-wrap gap-2">
            {following.map((b) => (
              <li key={b.id}>
                <Link href={`/b/${b.slug}`} className="flex items-center gap-2 rounded-full bg-paper py-1 ps-1 pe-3 text-sm shadow-[var(--shadow-soft)]">
                  <Avatar src={b.avatarUrl} name={b.name} size={28} /> {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {blocked.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">עסקים מוסתרים</h2>
          <ul className="flex flex-col gap-2">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3">
                {b.name}
                <Button size="sm" variant="ghost" onClick={() => unblock(b.id)}>
                  ביטול הסתרה
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button variant="secondary" className="w-full" onClick={logout}>
        <LogOut className="size-4" aria-hidden /> התנתקות
      </Button>
      <p className="mt-6 text-center text-xs text-muted">
        <Badge>BUBER גרסת פיילוט</Badge>
      </p>
    </main>
  );
}
