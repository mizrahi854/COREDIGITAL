import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CalendarDays, CalendarX2, ChevronLeft, Clock, CreditCard, MapPin, MessageCircle, RotateCcw, Star } from "lucide-react";
import clsx from "clsx";
import type { Appointment, AppointmentStatus, DB } from "../domain/types";
import { canCustomerChange, holdsSlot } from "../domain/booking";
import { price, STATUS_LABEL } from "../domain/format";
import { fmtDateTime, fmtRelative, fmtShortDate, fmtTime } from "../domain/time";
import { canReview, cancelAsCustomer, openConversation, rescheduleAsCustomer } from "../store/actions";
import { toast, useApp, useMe } from "../store/app";
import { Avatar, Badge, Button, EmptyState, LinkButton, Segmented } from "../ui/kit";
import { ConfirmDialog, Sheet } from "../ui/overlays";
import { useMediaUrl } from "../ui/hooks";
import { TopBar, Page } from "../ui/shell";
import { DemoPaymentSheet, SlotPicker } from "./booking";

export const STATUS_TONE: Record<AppointmentStatus, "ok" | "warn" | "bad" | "info" | "neutral" | "outline"> = {
  pending_approval: "warn",
  pending_payment: "info",
  confirmed: "ok",
  completed: "neutral",
  cancelled: "outline",
  rejected: "bad",
  no_show: "bad",
};

export function StatusBadge({ a }: { a: Appointment }) {
  return <Badge tone={STATUS_TONE[a.status]}>{a.status === "cancelled" && a.cancelledBy === "system" ? "פג תוקף" : STATUS_LABEL[a.status]}</Badge>;
}

function SignInNeeded({ title }: { title: string }) {
  return (
    <>
      <TopBar title={title} large />
      <Page>
        <EmptyState icon={<CalendarDays className="size-6" aria-hidden />} title="התחברו כדי לראות את התורים שלכם" text="אפשר לגלוש ולבחור טיפול גם בלי חשבון." action={<LinkButton to="/signin?next=/appointments">התחברות</LinkButton>} />
      </Page>
    </>
  );
}

export function AppointmentsScreen() {
  const db = useApp((s) => s.db);
  const me = useMe();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const now = Date.now();
  const mine = useMemo(() => db.appointments.filter((a) => a.customerId === me?.id), [db, me?.id]);
  if (!me) return <SignInNeeded title="התורים שלי" />;
  const upcoming = mine.filter((a) => ["pending_approval", "pending_payment", "confirmed"].includes(a.status) && Date.parse(a.end) > now).sort((x, y) => x.start.localeCompare(y.start));
  const past = mine.filter((a) => !upcoming.includes(a)).sort((x, y) => y.start.localeCompare(x.start));
  const list = tab === "upcoming" ? upcoming : past;
  return (
    <>
      <TopBar title="התורים שלי" large />
      <Page className="max-w-2xl">
        <Segmented
          label="סינון תורים"
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: `קרובים (${upcoming.length})` },
            { value: "past", label: `היסטוריה (${past.length})` },
          ]}
        />
        <ul className="mt-4 flex flex-col gap-3">
          {list.length === 0 && (
            <EmptyState
              icon={<CalendarDays className="size-6" aria-hidden />}
              title={tab === "upcoming" ? "אין תורים קרובים" : "אין עדיין היסטוריה"}
              text="מצאו השראה בפיד וקבעו ישירות מהעבודה שאהבתם."
              action={<LinkButton to="/">לפיד</LinkButton>}
            />
          )}
          {list.map((a) => (
            <li key={a.id}>
              <AppointmentCard a={a} db={db} reviewable={canReview(db, me.id, a.id)} />
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}

function AppointmentCard({ a, db, reviewable }: { a: Appointment; db: DB; reviewable: boolean }) {
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  const pro = db.professionals.find((x) => x.id === a.professionalId);
  return (
    <Link to={`/appointments/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-4 transition hover:bg-surface">
      <Avatar src={b.avatar} name={b.name} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold">{a.snapshot.serviceName}</span>
          <StatusBadge a={a} />
        </div>
        <div className="truncate text-sm text-muted">
          {b.name} · {pro?.name}
        </div>
        <div className="num mt-0.5 text-sm font-semibold">
          {fmtShortDate(a.start)} · {fmtTime(a.start)}
        </div>
        {a.status === "pending_payment" && <div className="mt-1 text-xs font-semibold text-info">יש לשלם מקדמה כדי לשריין</div>}
        {reviewable && (
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
            <Star className="size-3.5" aria-hidden /> אפשר לכתוב ביקורת
          </div>
        )}
      </div>
      <ChevronLeft className="size-5 text-muted" aria-hidden />
    </Link>
  );
}

export function AppointmentDetailScreen() {
  const { id } = useParams();
  const db = useApp((s) => s.db);
  const me = useMe();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const a = db.appointments.find((x) => x.id === id);
  if (!me) return <SignInNeeded title="פרטי תור" />;
  if (!a || a.customerId !== me.id)
    return (
      <>
        <TopBar title="פרטי תור" back />
        <Page>
          <EmptyState title="התור לא נמצא" text="ייתכן שהקישור שגוי או שהתור שייך לחשבון אחר." action={<LinkButton to="/appointments">לתורים שלי</LinkButton>} />
        </Page>
      </>
    );
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  const pro = db.professionals.find((x) => x.id === a.professionalId);
  const active = ["pending_approval", "pending_payment", "confirmed"].includes(a.status);
  const changeable = active && canCustomerChange(a);
  const review = db.reviews.find((r) => r.appointmentId === a.id);
  const reviewable = canReview(db, me.id, a.id);
  const balance = Math.max(0, a.snapshot.price - (a.payment.status === "paid_demo" ? a.payment.amount : 0));
  const message = () => {
    const cid = openConversation(b.id, a.id);
    if (cid) navigate(`/messages/${cid}`);
  };

  return (
    <>
      <TopBar title="פרטי תור" back="/appointments" />
      <Page className="max-w-2xl">
        <div className="flex items-center gap-3">
          <Avatar src={b.avatar} name={b.name} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black">{a.snapshot.serviceName}</h1>
            <Link to={`/b/${b.id}`} className="text-sm text-muted underline-offset-4 hover:underline">
              {b.name}
            </Link>
          </div>
          <StatusBadge a={a} />
        </div>

        {a.status === "pending_approval" && a.holdExpiresAt && (
          <Notice tone="warn">ממתין לאישור העסק. אם לא יאושר עד {fmtDateTime(a.holdExpiresAt)} — הבקשה תפוג והמועד ישוחרר.</Notice>
        )}
        {a.status === "pending_payment" && (
          <Notice tone="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>כדי לשריין, יש לשלם מקדמה של {price(a.snapshot.deposit)}{a.holdExpiresAt ? ` עד ${fmtTime(a.holdExpiresAt)}` : ""}.</span>
              <Button size="sm" onClick={() => setPayOpen(true)} disabled={!holdsSlot(a, new Date())}>
                <CreditCard className="size-4" aria-hidden /> תשלום (דמו)
              </Button>
            </div>
            {a.payment.status === "failed_demo" && <p className="mt-2 text-bad">ניסיון התשלום האחרון נכשל (סימולציה).</p>}
          </Notice>
        )}
        {(a.status === "cancelled" || a.status === "rejected") && (
          <Notice tone="bad">
            {a.status === "rejected" ? "העסק דחה את הבקשה" : a.cancelledBy === "system" ? "תוקף ההחזקה פג והמועד שוחרר" : a.cancelledBy === "customer" ? "ביטלת את התור" : a.cancelledBy === "admin" ? "התור בוטל על ידי צוות Beautigo" : "העסק ביטל את התור"}
            {a.cancelReason && a.cancelledBy !== "system" ? `: ${a.cancelReason}` : ""}
          </Notice>
        )}

        <dl className="mt-4 divide-y divide-line rounded-2xl border border-line">
          <Row icon={<Clock className="size-4" aria-hidden />} k="מועד" v={fmtDateTime(a.start)} />
          <Row icon={<Avatar src={pro?.avatar} name={pro?.name ?? ""} size={18} />} k="איש מקצוע" v={pro?.name} />
          <Row icon={<MapPin className="size-4" aria-hidden />} k="כתובת" v={a.snapshot.address} />
          <Row k="מחיר (נשמר בהזמנה)" v={`${a.snapshot.priceFrom ? "החל מ־" : ""}${price(a.snapshot.price)}`} />
          {a.snapshot.deposit > 0 && <Row k="מקדמה" v={`${price(a.snapshot.deposit)} · ${a.payment.status === "paid_demo" ? "שולמה (דמו)" : "לא שולמה"}`} />}
          <Row k="יתרה לתשלום בעסק" v={price(balance)} />
        </dl>

        {(a.inspirationPostIds.length > 0 || a.note) && (
          <section className="mt-4 rounded-2xl border border-line p-4">
            <h2 className="mb-2 font-bold">השראה והערה</h2>
            {a.note && <p className="mb-3 text-sm">״{a.note}״</p>}
            <div className="flex gap-2">
              {a.inspirationPostIds.map((pid) => (
                <InspirationThumb key={pid} db={db} postId={pid} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {reviewable && (
            <LinkButton to={`/review/${a.id}`} size="lg">
              <Star className="size-5" aria-hidden /> כתיבת ביקורת
            </LinkButton>
          )}
          {active && (
            <>
              <Button variant="secondary" size="lg" disabled={!changeable} onClick={() => setMoveOpen(true)}>
                <CalendarDays className="size-5" aria-hidden /> שינוי מועד
              </Button>
              <Button variant="danger" size="lg" disabled={!changeable} onClick={() => setCancelOpen(true)}>
                <CalendarX2 className="size-5" aria-hidden /> ביטול התור
              </Button>
            </>
          )}
          <Button variant="secondary" size="lg" onClick={message}>
            <MessageCircle className="size-5" aria-hidden /> הודעה לעסק
          </Button>
          {!active && (
            <LinkButton to={`/book/${b.id}?service=${a.serviceId}&pro=${a.professionalId}`} variant="secondary" size="lg">
              <RotateCcw className="size-5" aria-hidden /> הזמנה חוזרת
            </LinkButton>
          )}
        </div>
        {active && !changeable && <p className="mt-2 text-sm text-muted">לפי מדיניות העסק אפשר לשנות או לבטל עד {a.snapshot.cancelHours} שעות לפני התור. לשינוי כעת — שלחו הודעה לעסק.</p>}
        <p className="mt-4 text-xs text-muted">מדיניות: {a.snapshot.policyText}</p>
        {review && <p className="mt-2 text-sm">כתבת ביקורת · {"★".repeat(review.rating)}</p>}

        <details className="mt-6 rounded-2xl bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-semibold">היסטוריית התור</summary>
          <ol className="mt-3 flex flex-col gap-2">
            {a.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{HISTORY_LABEL[h.action] ?? h.action}</span>
                <span className="text-muted">{fmtRelative(h.at)}</span>
              </li>
            ))}
          </ol>
        </details>
      </Page>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="לבטל את התור?"
        body={`${a.snapshot.serviceName} · ${fmtDateTime(a.start)}. המועד ישוחרר לאחרים.${a.payment.status === "paid_demo" ? " החזר המקדמה בפועל תלוי במדיניות העסק (בדמו אין כסף אמיתי)." : ""}`}
        confirmLabel="ביטול התור"
        danger
        reason="optional"
        onConfirm={(r) => cancelAsCustomer(a.id, r) && toast("ok", "התור בוטל והמועד שוחרר")}
      />
      <RescheduleSheet open={moveOpen} onClose={() => setMoveOpen(false)} a={a} onPick={(start) => rescheduleAsCustomer(a.id, start)} />
      <DemoPaymentSheet open={payOpen} onClose={() => setPayOpen(false)} appointment={a} />
    </>
  );
}

export const HISTORY_LABEL: Record<string, string> = {
  created: "נוצר",
  approved: "אושר על ידי העסק",
  rejected: "נדחה",
  cancelled: "בוטל",
  rescheduled: "המועד שונה",
  deposit_paid: "מקדמה שולמה (דמו)",
  payment_failed: "תשלום נכשל (דמו)",
  completed: "הושלם",
  no_show: "סומן כלא הגיע/ה",
  expired: "פג תוקף והמועד שוחרר",
  created_manual: "נקבע ידנית על ידי העסק",
};

function Notice({ tone, children }: { tone: "warn" | "info" | "bad"; children: React.ReactNode }) {
  return <div className={clsx("mt-4 rounded-2xl p-4 text-sm", tone === "warn" ? "bg-warn-soft text-warn" : tone === "info" ? "bg-info-soft text-info" : "bg-bad-soft text-bad")}>{children}</div>;
}

function Row({ k, v, icon }: { k: string; v: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 text-sm">
      <dt className="flex items-center gap-2 text-muted">
        {icon}
        {k}
      </dt>
      <dd className="num text-end font-semibold">{v}</dd>
    </div>
  );
}

function InspirationThumb({ db, postId }: { db: DB; postId: string }) {
  const p = db.posts.find((x) => x.id === postId);
  const url = useMediaUrl(p?.cover ?? p?.media[0]?.poster ?? p?.media[0]?.src);
  if (!p) return null;
  return (
    <Link to={`/post/${p.id}`} className="block size-20 overflow-hidden rounded-xl bg-surface" aria-label="השראה">
      {url && <img src={url} alt="" className="media size-full object-cover" />}
    </Link>
  );
}

/** Pick a new time; the change applies only after explicit confirmation and is atomic. */
export function RescheduleSheet({ open, onClose, a, onPick, staffPro }: { open: boolean; onClose: () => void; a: Appointment; onPick: (start: string) => unknown; staffPro?: string }) {
  const db = useApp((s) => s.db);
  const [date, setDate] = useState<string>();
  const [start, setStart] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Sheet open={open} onClose={onClose} title="שינוי מועד" wide>
        <p className="mb-3 text-sm text-muted">
          מועד נוכחי: <span className="num font-semibold text-ink">{fmtDateTime(a.start)}</span>. התור המקורי נשאר עד שהשינוי יאושר.
        </p>
        <SlotPicker db={db} businessId={a.businessId} serviceId={a.serviceId} professionalId={staffPro ?? a.professionalId} date={date} selected={start} onDate={(d) => (setDate(d), setStart(undefined))} onPick={setStart} excludeAppointmentId={a.id} durationMin={a.snapshot.durationMin} />
        <Button size="lg" className="mt-4 w-full" disabled={!start} onClick={() => setConfirming(true)}>
          המשך
        </Button>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="לאשר את המועד החדש?"
        body={start ? `${fmtDateTime(a.start)} ← ${fmtDateTime(start)}` : ""}
        confirmLabel="אישור השינוי"
        onConfirm={() => {
          if (start && onPick(start)) {
            toast("ok", "המועד עודכן");
            onClose();
          }
        }}
      />
    </>
  );
}
