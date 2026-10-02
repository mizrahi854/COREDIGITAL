import { useState } from "react";
import { AlertTriangle, CalendarCheck2, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { fmtDateTime, fmtRelative } from "../../domain/time";
import { connectCalendar, disconnectCalendar, setCalendarState, syncCalendar, updateBusiness } from "../../store/actions";
import { toast } from "../../store/app";
import { calendarLabel } from "../../integrations/googleCalendar";
import { Badge, Button, DemoLabel, Field, Input, Select, Textarea, Toggle } from "../../ui/kit";
import { ConfirmDialog, Sheet } from "../../ui/overlays";
import { Page, TopBar } from "../../ui/shell";
import { useBiz } from "./common";

export function BizSettingsScreen() {
  const { db, business: b } = useBiz();
  const [policy, setPolicy] = useState(b.policy);
  const [replies, setReplies] = useState(b.quickReplies);
  const [newReply, setNewReply] = useState("");
  const events = db.integrationEvents.filter((e) => e.businessId === b.id).slice(0, 6);
  const dirty = JSON.stringify(policy) !== JSON.stringify(b.policy);

  return (
    <>
      <TopBar title="הגדרות עסק" back="/manage" />
      <Page className="max-w-2xl">
        <GoogleCalendarCard />

        {events.length > 0 && (
          <section className="mt-4 rounded-2xl border border-line p-4">
            <h2 className="mb-2 text-sm font-bold">אירועי אינטגרציה</h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <Badge tone={e.level === "error" ? (e.resolved ? "outline" : "bad") : "neutral"}>{e.level === "error" ? (e.resolved ? "טופל" : "שגיאה") : "מידע"}</Badge>
                  <span className="flex-1">{e.message}</span>
                  <span className="shrink-0 text-xs text-muted">{fmtRelative(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-line p-4">
          <h2 className="mb-3 font-bold">מדיניות הזמנה וביטול</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="ביטול/שינוי עד (שעות)" htmlFor="po-c">
              <Input id="po-c" type="number" min={0} value={policy.cancelHours} onChange={(e) => setPolicy({ ...policy, cancelHours: Number(e.target.value) })} />
            </Field>
            <Field label="תוקף בקשה ידנית (שעות)" htmlFor="po-r" hint="אחריו המועד משתחרר">
              <Input id="po-r" type="number" min={1} value={policy.requestExpiryHours} onChange={(e) => setPolicy({ ...policy, requestExpiryHours: Number(e.target.value) })} />
            </Field>
            <Field label="החזקה לתשלום (דקות)" htmlFor="po-p">
              <Input id="po-p" type="number" min={5} value={policy.paymentHoldMinutes} onChange={(e) => setPolicy({ ...policy, paymentHoldMinutes: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="נוסח המדיניות ללקוחות" htmlFor="po-t">
            <Textarea id="po-t" value={policy.text} maxLength={400} onChange={(e) => setPolicy({ ...policy, text: e.target.value })} />
          </Field>
          <p className="mt-2 text-xs text-muted">שינוי מדיניות חל על הזמנות חדשות; תורים קיימים שומרים את המדיניות שבה הוזמנו.</p>
          <Button
            className="mt-3"
            disabled={!dirty}
            onClick={() => {
              if (policy.cancelHours < 0 || policy.requestExpiryHours < 1 || policy.paymentHoldMinutes < 5) return toast("error", "ערכים לא תקינים");
              if (updateBusiness({ policy }) !== undefined) toast("ok", "המדיניות נשמרה");
            }}
          >
            שמירת מדיניות
          </Button>
        </section>

        <section className="mt-6 rounded-2xl border border-line p-4">
          <h2 className="mb-1 font-bold">תשובות מהירות</h2>
          <p className="mb-3 text-sm text-muted">מוצגות מעל תיבת ההודעה בשיחות עם לקוחות.</p>
          <ul className="flex flex-col gap-2">
            {replies.map((r, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="flex-1">{r}</span>
                <button type="button" aria-label="מחיקה" className="grid size-8 place-items-center rounded-full hover:bg-bg" onClick={() => setReplies(replies.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newReply.trim()) setReplies([...replies, newReply.trim()].slice(0, 8));
              setNewReply("");
            }}
          >
            <Input value={newReply} onChange={(e) => setNewReply(e.target.value)} placeholder="תשובה חדשה" aria-label="תשובה מהירה חדשה" maxLength={120} />
            <Button type="submit" variant="secondary" aria-label="הוספה" className="w-12 px-0">
              <Plus className="size-5" />
            </Button>
          </form>
          <Button className="mt-3" disabled={JSON.stringify(replies) === JSON.stringify(b.quickReplies)} onClick={() => updateBusiness({ quickReplies: replies }) !== undefined && toast("ok", "נשמר")}>
            שמירה
          </Button>
        </section>
      </Page>
    </>
  );
}

/** Simulated Google Calendar connection. No OAuth, no network — clearly labelled. */
function GoogleCalendarCard() {
  const { business: b } = useBiz();
  const c = b.calendar;
  const [picker, setPicker] = useState<{ accountEmail: string; calendars: { id: string; name: string }[] } | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface">
          <CalendarCheck2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold">Google Calendar</h2>
            <Badge tone={c.status === "connected" ? "ok" : c.status === "error" ? "bad" : "outline"}>{calendarLabel(c)}</Badge>
          </div>
          <DemoLabel className="mt-1">סימולציה — אין חיבור אמיתי לחשבון Google</DemoLabel>
        </div>
      </div>
      {c.status === "error" && (
        <div role="alert" className="mt-3 flex gap-2 rounded-xl bg-bad-soft p-3 text-sm text-bad">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <div>
            <div className="font-semibold">הסנכרון נכשל</div>
            <div>{c.lastError}</div>
            <div className="mt-1 text-xs">תורים ב־Beautigo לא נפגעו. אפשר לנסות שוב או לחבר מחדש.</div>
          </div>
        </div>
      )}
      {c.status !== "disconnected" ? (
        <>
          <dl className="mt-3 grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">חשבון</dt>
              <dd dir="ltr">{c.accountEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">יומן</dt>
              <dd>{c.calendarName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">סנכרון אחרון</dt>
              <dd className="num">{c.lastSyncAt ? fmtDateTime(c.lastSyncAt) : "עוד לא"}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <Toggle id="gc-fail" label="סימולציית כשל בסנכרון הבא" description="לבדיקת מצב שגיאה (invalid_grant)" checked={!!c.simulateFailure} onChange={(v) => setCalendarState({ simulateFailure: v })} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              loading={busy === "sync"}
              disabled={!!busy}
              onClick={async () => {
                setBusy("sync");
                await syncCalendar();
                setBusy(null);
              }}
            >
              <RefreshCw className="size-4" aria-hidden /> סנכרון עכשיו
            </Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => setConfirm(true)}>
              <Unplug className="size-4" aria-hidden /> ניתוק
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">בגרסה אמיתית: התחברות מאובטחת עם Google, בחירת יומן, ותורים מאושרים יסונכרנו אליו. זמנים תפוסים מהיומן ייחסמו ב־Beautigo.</p>
          <Button
            className="mt-3"
            loading={busy === "connect"}
            onClick={async () => {
              setBusy("connect");
              const r = await connectCalendar();
              setBusy(null);
              if (r) {
                setPicker(r);
                setChoice(r.calendars[1]?.id ?? r.calendars[0].id);
              }
            }}
          >
            חיבור (סימולציה)
          </Button>
        </>
      )}
      <Sheet open={!!picker} onClose={() => setPicker(null)} title="בחירת יומן (סימולציה)">
        <p className="mb-3 text-sm text-muted">
          חשבון דמו: <span dir="ltr">{picker?.accountEmail}</span>
        </p>
        <Select aria-label="יומן" value={choice} onChange={(e) => setChoice(e.target.value)}>
          {picker?.calendars.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={() => {
            const cal = picker!.calendars.find((x) => x.id === choice)!;
            setCalendarState({ status: "connected", accountEmail: picker!.accountEmail, calendarId: cal.id, calendarName: cal.name, lastError: undefined });
            setPicker(null);
            toast("ok", "היומן חובר (סימולציה)");
          }}
        >
          חיבור היומן
        </Button>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="לנתק את Google Calendar?"
        body="התורים ב־Beautigo לא יושפעו. אירועים שכבר סונכרנו יישארו ביומן Google."
        confirmLabel="ניתוק"
        danger
        onConfirm={async () => {
          setBusy("disconnect");
          await disconnectCalendar();
          setBusy(null);
          toast("ok", "נותק");
        }}
      />
    </section>
  );
}
