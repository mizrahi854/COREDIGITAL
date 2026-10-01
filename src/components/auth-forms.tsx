"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, UserRound, Wand2 } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { Button, Field, Input } from "./ui";

function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export function LoginForm({ devAccounts }: { devAccounts: { email: string; label: string }[] | null }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const done = (onboarded = true) => {
    router.push(onboarded ? safeNext(next, "/") : `/onboarding?next=${encodeURIComponent(safeNext(next, "/"))}`);
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("form");
    setError(null);
    try {
      const r = await apiFetch<{ onboarded: boolean }>("/api/auth/login", { body: { email, password } });
      done(r.onboarded);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const devLogin = async (em: string) => {
    setBusy(em);
    try {
      await apiFetch("/api/dev/login", { body: { email: em } });
      done();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">שמחים לראות אותך</h1>
        <p className="mt-1 text-muted">התחברו כדי לקבוע תורים, לשמור השראות ולעקוב אחרי עסקים.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="אימייל" id="email">
          <Input id="email" type="email" autoComplete="email" inputMode="email" dir="ltr" className="text-start" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="סיסמה" id="password">
          <Input id="password" type="password" autoComplete="current-password" dir="ltr" className="text-start" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && (
          <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy === "form"}>
          התחברות
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        אין לך חשבון?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline underline-offset-4">
          הצטרפות
        </Link>
      </p>

      {devAccounts && (
        <section className="rounded-[var(--radius-card)] border border-dashed border-bronze/50 bg-bronze-soft/40 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-bronze-ink">
            <Wand2 className="size-4" aria-hidden /> כניסה מהירה לבדיקות (מצב פיתוח בלבד)
          </h2>
          <p className="mb-3 text-xs text-muted">חשבונות הדמו מה־seed. הכפתורים האלה כבויים בפרודקשן. סיסמה לכולם: buber1234</p>
          <div className="grid grid-cols-2 gap-2">
            {devAccounts.map((a) => (
              <Button key={a.email} variant="secondary" size="sm" loading={busy === a.email} onClick={() => devLogin(a.email)}>
                {a.label}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [kind, setKind] = useState<"customer" | "business">("customer");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/signup", { body: form });
      router.push(kind === "business" ? "/biz/new" : `/onboarding?next=${encodeURIComponent(safeNext(next, "/"))}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">הצטרפות ל־BUBER</h1>
        <p className="mt-1 text-muted">חשבון אחד — אפשר להיות לקוח/ה וגם לנהל עסק.</p>
      </div>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="סוג הצטרפות">
        {(
          [
            ["customer", "אני מחפש/ת טיפולים", UserRound],
            ["business", "יש לי עסק", Store],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={clsx("flex flex-col items-start gap-2 rounded-[var(--radius-card)] border-2 p-4 text-start transition", kind === k ? "border-ink bg-paper" : "border-line bg-paper/60 hover:bg-paper")}
          >
            <Icon className="size-6 text-bronze-ink" aria-hidden />
            <span className="font-semibold">{label}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="שם מלא" id="name">
          <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} required />
        </Field>
        <Field label="אימייל" id="email">
          <Input id="email" type="email" autoComplete="email" dir="ltr" className="text-start" value={form.email} onChange={set("email")} required />
        </Field>
        <Field label="טלפון" id="phone" hint="לא חובה. העסק יראה אותו רק בתורים שקבעת אצלו.">
          <Input id="phone" type="tel" autoComplete="tel" dir="ltr" className="text-start" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="סיסמה" id="password" hint="לפחות 8 תווים">
          <Input id="password" type="password" autoComplete="new-password" dir="ltr" className="text-start" value={form.password} onChange={set("password")} required minLength={8} />
        </Field>
        {error && (
          <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy}>
          {kind === "business" ? "המשך להקמת העסק" : "יצירת חשבון"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        כבר רשום/ה?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline underline-offset-4">
          התחברות
        </Link>
      </p>
    </div>
  );
}
