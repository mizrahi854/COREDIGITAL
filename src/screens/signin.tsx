import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { CategoryId } from "../domain/types";
import { CATEGORIES } from "../domain/format";
import { registerCustomer, signInAs } from "../store/actions";
import { useApp } from "../store/app";
import { Avatar, Button, Chip, DemoLabel, Field, Input, Segmented, Select } from "../ui/kit";
import { Page, TopBar } from "../ui/shell";

/**
 * Demo sign-in and customer registration. There is no password or verification:
 * this is a local demo session, not production authentication.
 */
export function SignInScreen() {
  const [sp] = useSearchParams();
  const next = sp.get("next");
  const navigate = useNavigate();
  const db = useApp((s) => s.db);
  const draft = useApp((s) => s.bookingDraft);
  const [tab, setTab] = useState<"demo" | "register">("demo");
  const [form, setForm] = useState({ name: "", phone: "", cityId: "tlv" });
  const [interests, setInterests] = useState<CategoryId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const customers = db.users.filter((u) => u.role === "customer" && u.status === "active").slice(0, 4);
  const go = () => navigate(next && next.startsWith("/") ? next : "/", { replace: true });

  const register = () => {
    if (form.name.trim().length < 2) return setError("נא להזין שם מלא");
    if (!/^0\d{1,2}-?\d{7}$/.test(form.phone.replace(/\s/g, ""))) return setError("מספר טלפון ישראלי לא תקין (למשל 050-1234567)");
    const u = registerCustomer({ name: form.name, phone: form.phone, cityId: form.cityId, interests });
    if (u) {
      signInAs(u.id);
      go();
    }
  };

  return (
    <>
      <TopBar title="התחברות" back />
      <Page className="max-w-md">
        {draft && next?.startsWith("/book") && (
          <div className="mb-4 rounded-2xl bg-surface p-4 text-sm">
            ההזמנה שלך שמורה — אחרי ההתחברות נחזור בדיוק לאותו שלב, עם אותו שירות, איש מקצוע ומועד.
          </div>
        )}
        <div className="mb-5 flex items-center gap-2">
          <h1 className="text-2xl font-black">כניסה ל־Beautigo</h1>
          <DemoLabel>דמו</DemoLabel>
        </div>
        <Segmented
          label="סוג כניסה"
          value={tab}
          onChange={setTab}
          options={[
            { value: "demo", label: "חשבון לקוח לדוגמה" },
            { value: "register", label: "הרשמה מהירה" },
          ]}
        />
        {tab === "demo" ? (
          <div className="mt-5 flex flex-col gap-2">
            <p className="mb-1 text-sm text-muted">כניסה בלחיצה לחשבון לקוח לדוגמה. אין סיסמה כי זה דמו מקומי.</p>
            {customers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  signInAs(u.id);
                  go();
                }}
                className="flex h-16 items-center gap-3 rounded-2xl border border-line px-4 text-start hover:bg-surface"
              >
                <Avatar name={u.name} size={40} />
                <span className="flex-1">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="block text-xs text-muted">{db.cities.find((c) => c.id === u.cityId)?.name}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              register();
            }}
            noValidate
          >
            <Field label="שם מלא" htmlFor="r-name">
              <Input id="r-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="טלפון" htmlFor="r-phone" hint="בדמו לא נשלח קוד אימות.">
              <Input id="r-phone" type="tel" inputMode="tel" dir="ltr" className="text-start" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="עיר" htmlFor="r-city">
              <Select id="r-city" value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
                {db.cities.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">תחומי עניין</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Chip key={c.id} active={interests.includes(c.id)} onClick={() => setInterests((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">
                {error}
              </p>
            )}
            <Button type="submit" size="lg">
              יצירת חשבון לקוח
            </Button>
            <p className="text-center text-xs text-muted">רוצים לפתוח עסק? בעסקים חשבונות נפתחים בתהליך הצטרפות נפרד — בדמו אפשר להיכנס כבעלת עסק דרך ״מצב דמו״.</p>
          </form>
        )}
      </Page>
    </>
  );
}
