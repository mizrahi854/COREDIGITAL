import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Check, Clock, MessageCircle, Phone, X } from "lucide-react";
import type { AppointmentStatus } from "../../domain/types";
import { price, STATUS_LABEL } from "../../domain/format";
import { fmtDateTime, fmtRelative, fmtShortDate, fmtTime } from "../../domain/time";
import { approveAppointment, cancelAsBusiness, markOutcome, rejectAppointment, rescheduleAsBusiness, setBusinessNote } from "../../store/actions";
import { toast } from "../../store/app";
import { Avatar, Badge, Button, Chip, EmptyState, LinkButton, Select, Textarea } from "../../ui/kit";
import { ConfirmDialog } from "../../ui/overlays";
import { useMediaUrl } from "../../ui/hooks";
import { Page, TopBar } from "../../ui/shell";
import { HISTORY_LABEL, RescheduleSheet, StatusBadge } from "../appointments";
import { customerName, customerOf, useBiz } from "./common";

const FILTERS: (AppointmentStatus | "all" | "upcoming")[] = ["upcoming", "pending_approval", "pending_payment", "confirmed", "completed", "no_show", "cancelled", "rejected", "all"];

export function BizAppointmentsScreen() {
  const { db, appointments, pros, isStaff } = useBiz();
  const [sp, setSp] = useSearchParams();
  const f = (sp.get("f") ?? "upcoming") as (typeof FILTERS)[number];
  const [pro, setPro] = useState("all");
  const list = appointments
    .filter((a) => (f === "all" ? true : f === "upcoming" ? ["pending_approval", "pending_payment", "confirmed"].includes(a.status) && Date.parse(a.end) > Date.now() : a.status === f))
    .filter((a) => pro === "all" || a.professionalId === pro)
    .sort((x, y) => (f === "upcoming" || f === "pending_approval" ? x.start.localeCompare(y.start) : y.start.localeCompare(x.start)));
  const count = (s: AppointmentStatus) => appointments.filter((a) => a.status === s).length;
  return (
    <>
      <TopBar title="תורים ובקשות" back="/manage" />
      <Page className="max-w-3xl">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((x) => (
            <Chip key={x} active={f === x} onClick={() => setSp({ f: x }, { replace: true })}>
              {x === "all" ? "הכול" : x === "upcoming" ? "קרובים" : STATUS_LABEL[x]}
              {x !== "all" && x !== "upcoming" && count(x) > 0 && <span className="num opacity-70">{count(x)}</span>}
            </Chip>
          ))}
        </div>
        {!isStaff && pros.length > 1 && (
          <Select aria-label="איש צוות" className="mt-3 h-10 w-auto" value={pro} onChange={(e) => setPro(e.target.value)}>
            <option value="all">כל הצוות</option>
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <ul className="mt-4 flex flex-col gap-2">
          {list.length === 0 && <EmptyState title="אין תורים בסינון הזה" />}
          {list.map((a) => (
            <li key={a.id}>
              <Link to={`/manage/appointments/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-surface">
                <div className="num w-16 shrink-0 text-center">
                  <div className="text-xs text-muted">{fmtShortDate(a.start)}</div>
                  <div className="font-bold">{fmtTime(a.start)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {customerName(db, a)}
                    {!a.customerId && <span className="ms-1 text-xs font-normal text-muted">(ידני)</span>}
                  </div>
                  <div className="truncate text-sm text-muted">
                    {a.snapshot.serviceName} · {db.professionals.find((p) => p.id === a.professionalId)?.name}
                  </div>
                </div>
                <StatusBadge a={a} />
              </Link>
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}

export function BizAppointmentDetail() {
  const { id } = useParams();
  const { db, appointments, isStaff, business: b } = useBiz();
  const a = appointments.find((x) => x.id === id);
  const [dialog, setDialog] = useState<null | "reject" | "cancel" | "complete" | "no_show" | "approve">(null);
  const [move, setMove] = useState(false);
  const [note, setNote] = useState(a?.businessNote ?? "");
  if (!a)
    return (
      <>
        <TopBar title="תור" back="/manage/appointments" />
        <Page>
          <EmptyState title="התור לא נמצא או שאין לך גישה אליו" text={isStaff ? "לצוות יש גישה רק לתורים ביומן שלהם." : undefined} action={<LinkButton to="/manage/appointments">לכל התורים</LinkButton>} />
        </Page>
      </>
    );
  const cust = customerOf(db, a);
  const pro = db.professionals.find((p) => p.id === a.professionalId);
  const started = Date.parse(a.start) <= Date.now();
  const history = cust ? db.appointments.filter((x) => x.customerId === cust.id && x.businessId === b.id && x.id !== a.id) : [];
  const conv = cust ? db.conversations.find((c) => c.customerId === cust.id && c.businessId === b.id) : undefined;
  const source = a.sourcePostId ? db.posts.find((p) => p.id === a.sourcePostId) : undefined;
  return (
    <>
      <TopBar title="פרטי תור" back="/manage/appointments" />
      <Page className="max-w-3xl">
        <div className="flex items-center gap-3">
          <Avatar name={customerName(db, a)} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black">{customerName(db, a)}</h1>
            <p className="text-sm text-muted">
              {a.snapshot.serviceName} · {pro?.name}
            </p>
          </div>
          <StatusBadge a={a} />
        </div>

        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <Info k="מועד" v={fmtDateTime(a.start)} />
          <Info k="משך" v={`${a.snapshot.durationMin} דק׳ + ${a.snapshot.bufferMin} דק׳ מרווח`} />
          <Info k="מחיר שנשמר" v={`${a.snapshot.priceFrom ? "החל מ־" : ""}${price(a.snapshot.price)}`} />
          <Info k="מקדמה" v={a.snapshot.deposit ? `${price(a.snapshot.deposit)} · ${a.payment.status === "paid_demo" ? "שולמה (דמו)" : a.payment.status === "failed_demo" ? "נכשלה (דמו)" : "לא שולמה"}` : "אין — תשלום בעסק"} />
          {a.holdExpiresAt && <Info k="ההחזקה פגה" v={fmtDateTime(a.holdExpiresAt)} />}
          {a.guestPhone && <Info k="טלפון" v={<span dir="ltr">{a.guestPhone}</span>} />}
          {source && <Info k="הגיע/ה מתוכן" v={<Link className="underline" to={`/post/${source.id}`}>{source.caption.slice(0, 32)}…</Link>} />}
        </dl>

        {(a.note || a.inspirationPostIds.length > 0) && (
          <section className="mt-4 rounded-2xl border border-line p-4">
            <h2 className="mb-2 font-bold">מהלקוח/ה</h2>
            {a.note && <p className="mb-3 text-sm">״{a.note}״</p>}
            <div className="flex flex-wrap gap-2">
              {a.inspirationPostIds.map((pid) => (
                <Inspo key={pid} postId={pid} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {a.status === "pending_approval" && (
            <>
              <Button onClick={() => setDialog("approve")}>
                <Check className="size-4" aria-hidden /> אישור
              </Button>
              <Button variant="danger" onClick={() => setDialog("reject")}>
                <X className="size-4" aria-hidden /> דחייה
              </Button>
            </>
          )}
          {a.status === "confirmed" && started && (
            <>
              <Button onClick={() => setDialog("complete")}>סימון כהושלם</Button>
              <Button variant="secondary" onClick={() => setDialog("no_show")}>
                לא הגיע/ה
              </Button>
            </>
          )}
          {["pending_approval", "pending_payment", "confirmed"].includes(a.status) && (
            <>
              <Button variant="secondary" onClick={() => setMove(true)}>
                <Clock className="size-4" aria-hidden /> שינוי מועד
              </Button>
              <Button variant="danger" onClick={() => setDialog("cancel")}>
                ביטול
              </Button>
            </>
          )}
          {conv && !isStaff && (
            <LinkButton to={`/messages/${conv.id}`} variant="secondary">
              <MessageCircle className="size-4" aria-hidden /> לשיחה
            </LinkButton>
          )}
          {a.guestPhone && (
            <a href={`tel:${a.guestPhone}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-surface px-5 font-semibold">
              <Phone className="size-4" aria-hidden /> חיוג
            </a>
          )}
        </div>
        {a.status === "confirmed" && !started && <p className="mt-2 text-xs text-muted">סימון ״הושלם״ או ״לא הגיע/ה״ זמין אחרי תחילת התור.</p>}

        <section className="mt-6">
          <label htmlFor="bn" className="font-bold">
            הערה פנימית
          </label>
          <p className="text-xs text-muted">גלויה לעסק ולצוות בלבד.</p>
          <Textarea id="bn" className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <Button size="sm" variant="secondary" className="mt-2" disabled={note === (a.businessNote ?? "")} onClick={() => setBusinessNote(a.id, note) !== undefined && toast("ok", "ההערה נשמרה")}>
            שמירת הערה
          </Button>
        </section>

        {cust && !isStaff && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">היסטוריית לקוח/ה</h2>
              <Link to={`/manage/customers/${cust.id}`} className="text-sm font-semibold underline">
                לכרטיס הלקוח/ה
              </Link>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted">זה התור הראשון אצלכם.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                    <span>{h.snapshot.serviceName}</span>
                    <span className="num text-muted">
                      {fmtShortDate(h.start)} · {STATUS_LABEL[h.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <details className="mt-6 rounded-2xl bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-semibold">יומן שינויים</summary>
          <ol className="mt-3 flex flex-col gap-2">
            {a.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {HISTORY_LABEL[h.action] ?? h.action}
                  {h.detail && h.action !== "created" && h.action !== "rescheduled" ? ` — ${h.detail}` : ""}
                </span>
                <span className="text-muted">{fmtRelative(h.at)}</span>
              </li>
            ))}
          </ol>
        </details>
      </Page>

      <ConfirmDialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title="לאשר את הבקשה?"
        body={a.snapshot.payment === "deposit" ? `הלקוח/ה יתבקש/תתבקש לשלם מקדמה של ${price(a.snapshot.deposit)} (דמו) כדי לשריין.` : "התור יאושר והלקוח/ה יקבל/תקבל התראה באפליקציה."}
        confirmLabel="אישור"
        onConfirm={() => approveAppointment(a.id) && toast("ok", "הבקשה אושרה")}
      />
      <ConfirmDialog open={dialog === "reject"} onClose={() => setDialog(null)} title="לדחות את הבקשה?" body="המועד ישוחרר. הסיבה תוצג ללקוח/ה." confirmLabel="דחייה" danger reason="optional" onConfirm={(r) => rejectAppointment(a.id, r) && toast("ok", "הבקשה נדחתה")} />
      <ConfirmDialog open={dialog === "cancel"} onClose={() => setDialog(null)} title="לבטל את התור?" body="הלקוח/ה יקבל/תקבל התראה באפליקציה והמועד ישוחרר." confirmLabel="ביטול התור" danger reason="required" onConfirm={(r) => cancelAsBusiness(a.id, r) && toast("ok", "התור בוטל")} />
      <ConfirmDialog open={dialog === "complete"} onClose={() => setDialog(null)} title="לסמן כהושלם?" body="הלקוח/ה יוכל/תוכל לכתוב ביקורת." confirmLabel="הושלם" onConfirm={() => markOutcome(a.id, "completed") && toast("ok", "סומן כהושלם")} />
      <ConfirmDialog open={dialog === "no_show"} onClose={() => setDialog(null)} title="לסמן ״לא הגיע/ה״?" confirmLabel="סימון" danger onConfirm={() => markOutcome(a.id, "no_show") && toast("ok", "סומן כלא הגיע/ה")} />
      <RescheduleSheet open={move} onClose={() => setMove(false)} a={a} onPick={(start) => rescheduleAsBusiness(a.id, start)} />
    </>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="num mt-0.5 text-sm font-semibold">{v}</dd>
    </div>
  );
}

function Inspo({ postId }: { postId: string }) {
  const { db } = useBiz();
  const p = db.posts.find((x) => x.id === postId);
  const url = useMediaUrl(p?.cover ?? p?.media[0]?.poster ?? p?.media[0]?.src);
  if (!p) return <Badge tone="outline">השראה שהוסרה</Badge>;
  return (
    <Link to={`/post/${p.id}`} className="block h-28 w-20 overflow-hidden rounded-xl bg-surface" aria-label="תמונת השראה">
      {url && <img src={url} alt="" className="media size-full object-cover" />}
    </Link>
  );
}
