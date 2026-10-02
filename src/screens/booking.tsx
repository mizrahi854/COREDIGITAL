import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AlertTriangle, Check, CheckCircle2, Clock, CreditCard, Hourglass, Info, Users } from "lucide-react";
import clsx from "clsx";
import { DateTime } from "luxon";
import type { Appointment, DB, ID, Post, Service } from "../domain/types";
import { availableDays, depositFor, getSlots } from "../domain/booking";
import { duration, price, STATUS_LABEL, WEEKDAYS_SHORT } from "../domain/format";
import { TZ, fmtDate, fmtDateTime, fmtTime, local } from "../domain/time";
import { proRating } from "../domain/discover";
import { book, payDeposit } from "../store/actions";
import { gate, useApp, useMe, useMode, type BookingDraft } from "../store/app";
import { DemoPayments } from "../integrations/payments";
import { Avatar, Badge, Button, DemoLabel, EmptyState, LinkButton, Textarea } from "../ui/kit";
import { Sheet } from "../ui/overlays";
import { useMediaUrl } from "../ui/hooks";
import { TopBar } from "../ui/shell";

const STEPS = ["שירות", "איש מקצוע", "מועד", "השראה", "סיכום"];

function setDraft(patch: Partial<BookingDraft>) {
  useApp.setState((s) => (s.bookingDraft ? { bookingDraft: { ...s.bookingDraft, ...patch } } : {}));
}

export function BookingScreen() {
  const { businessId } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const db = useApp((s) => s.db);
  const me = useMe();
  const mode = useMode();
  const draft = useApp((s) => s.bookingDraft);
  const [done, setDone] = useState<ID | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const b = db.businesses.find((x) => x.id === businessId);

  // Initialise (or reuse a restored) draft for this business
  useEffect(() => {
    if (!b) return;
    const post = sp.get("post") ?? undefined;
    const service = sp.get("service") ?? undefined;
    const pro = sp.get("pro") ?? undefined;
    const fresh = !draft || draft.businessId !== b.id || post || service || pro;
    if (!fresh) return;
    const svc = db.services.find((s) => s.id === service && s.businessId === b.id && s.active);
    const proOk = db.professionals.find((p) => p.id === pro && p.businessId === b.id && p.active && (!svc || p.serviceIds.includes(svc.id)));
    useApp.setState({
      bookingDraft: {
        businessId: b.id,
        serviceId: svc?.id,
        professionalId: proOk ? proOk.id : undefined,
        note: "",
        inspirationPostIds: post ? [post] : [],
        sourcePostId: post,
        step: svc ? (proOk ? 2 : 1) : 0,
      },
    });
    if (post || service || pro) navigate(`/book/${b.id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.id, sp.toString()]);

  if (!b || b.status !== "active")
    return (
      <>
        <TopBar title="קביעת תור" back />
        <div className="p-4">
          <EmptyState title="העסק לא זמין להזמנות" action={<LinkButton to="/discover">לגילוי עסקים</LinkButton>} />
        </div>
      </>
    );

  if (done) return <BookingDone appointmentId={done} />;
  if (!draft || draft.businessId !== b.id) return null;

  const step = draft.step ?? 0;
  const service = db.services.find((s) => s.id === draft.serviceId);
  const pro = draft.professionalId ? db.professionals.find((p) => p.id === draft.professionalId) : null;
  const goto = (n: number) => {
    setDraft({ step: n });
    window.scrollTo({ top: 0 });
  };

  const confirm = () => {
    if (!service || !draft.start) return;
    if (!gate("כדי לשריין את המועד צריך חשבון. הבחירות שלך נשמרות.", `/book/${b.id}`)) return;
    if (mode !== "customer" || me?.role !== "customer") return;
    setSubmitting(true);
    const a = book({ businessId: b.id, serviceId: service.id, professionalId: draft.professionalId ?? null, start: draft.start, note: draft.note, inspirationPostIds: draft.inspirationPostIds, sourcePostId: draft.sourcePostId });
    setSubmitting(false);
    if (a) {
      useApp.setState({ bookingDraft: null });
      setDone(a.id);
    } else {
      // Most likely the slot was taken meanwhile — send the customer back to time selection
      setConflict(true);
      setDraft({ start: undefined, step: 2 });
    }
  };

  return (
    <>
      <TopBar title={`תור ב${b.name}`} sub={STEPS[step]} back={step > 0 ? undefined : true} actions={step > 0 ? <Button variant="ghost" size="sm" onClick={() => goto(step - 1)}>הקודם</Button> : undefined} />
      <div className="mx-auto max-w-2xl px-4 pb-40 pt-3 lg:px-6">
        <ol className="mb-5 flex gap-1.5" aria-label="שלבי ההזמנה">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                type="button"
                disabled={i > step}
                onClick={() => goto(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`${i + 1}. ${s}`}
                className={clsx("h-1.5 w-full rounded-full transition", i <= step ? "bg-ink" : "bg-surface-2")}
              />
            </li>
          ))}
        </ol>

        {me && me.role !== "customer" && (
          <div className="mb-4 flex gap-2 rounded-2xl bg-warn-soft p-3 text-sm text-warn">
            <Info className="size-5 shrink-0" aria-hidden />
            <span>
              הזמנת תורים זמינה לחשבון לקוח בלבד. אפשר לעבור לחשבון לקוח ב<Link to="/demo" className="font-semibold underline">מצב דמו</Link>.
            </span>
          </div>
        )}
        {conflict && step === 2 && (
          <div role="alert" className="mb-4 flex gap-2 rounded-2xl bg-bad-soft p-3 text-sm text-bad">
            <AlertTriangle className="size-5 shrink-0" aria-hidden /> המועד שבחרת נתפס בינתיים. בחרו שעה אחרת — שאר הפרטים נשמרו.
          </div>
        )}

        {step === 0 && <ServiceStep db={db} businessId={b.id} selected={draft.serviceId} onPick={(id) => (setDraft({ serviceId: id, start: undefined, professionalId: pro && pro.serviceIds.includes(id) ? pro.id : undefined }), goto(1))} />}
        {step === 1 && service && <ProStep db={db} service={service} selected={draft.professionalId} onPick={(id) => (setDraft({ professionalId: id, start: undefined }), goto(2))} />}
        {step === 2 && service && (
          <SlotPicker
            db={db}
            businessId={b.id}
            serviceId={service.id}
            professionalId={draft.professionalId ?? null}
            date={draft.date}
            selected={draft.start}
            onDate={(date) => setDraft({ date, start: undefined })}
            onPick={(start) => {
              setConflict(false);
              setDraft({ start });
            }}
          />
        )}
        {step === 3 && <InspirationStep db={db} businessId={b.id} draft={draft} />}
        {step === 4 && service && draft.start && <ReviewStep db={db} draft={draft} service={service} />}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-4 lg:ps-72">
        <div className="glass mx-auto flex max-w-2xl items-center gap-3 rounded-[24px] p-3">
          <div className="min-w-0 flex-1 text-sm">
            {service ? (
              <>
                <div className="truncate font-semibold">{service.name}</div>
                <div className="truncate text-muted">
                  {price(service.price, service.priceFrom)}
                  {draft.start ? ` · ${fmtDateTime(draft.start)}` : ""}
                </div>
              </>
            ) : (
              <span className="text-muted">בחרו שירות כדי להתחיל</span>
            )}
          </div>
          {step === 2 && (
            <Button disabled={!draft.start} onClick={() => goto(3)}>
              המשך
            </Button>
          )}
          {step === 3 && <Button onClick={() => goto(4)}>לסיכום</Button>}
          {step === 4 && (
            <Button size="lg" loading={submitting} disabled={!draft.start || (!!me && me.role !== "customer")} onClick={confirm}>
              {service?.approval === "manual" ? "שליחת בקשה" : service?.payment === "deposit" ? "המשך לתשלום מקדמה" : "אישור התור"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function ServiceStep({ db, businessId, selected, onPick }: { db: DB; businessId: ID; selected?: ID; onPick: (id: ID) => void }) {
  const services = db.services.filter((s) => s.businessId === businessId && s.active);
  return (
    <section>
      <h2 className="mb-3 text-xl font-black">איזה טיפול?</h2>
      <ul className="flex flex-col gap-2">
        {services.map((s) => {
          const dep = depositFor(s);
          return (
            <li key={s.id}>
              <button type="button" onClick={() => onPick(s.id)} aria-pressed={selected === s.id} className={clsx("flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition hover:bg-surface", selected === s.id ? "border-ink ring-1 ring-ink" : "border-line")}>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{s.name}</div>
                  {s.description && <p className="text-sm text-muted">{s.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge>
                      <Clock className="size-3" aria-hidden /> {duration(s.durationMin)}
                    </Badge>
                    {s.approval === "manual" && <Badge tone="warn">באישור העסק</Badge>}
                    {dep > 0 && <Badge tone="info">מקדמה {price(dep)}</Badge>}
                  </div>
                </div>
                <span className="num shrink-0 font-bold">{price(s.price, s.priceFrom)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProStep({ db, service, selected, onPick }: { db: DB; service: Service; selected?: ID | null; onPick: (id: ID | null) => void }) {
  const pros = db.professionals.filter((p) => p.businessId === service.businessId && p.active && p.serviceIds.includes(service.id));
  return (
    <section>
      <h2 className="mb-3 text-xl font-black">אצל מי?</h2>
      <ul className="flex flex-col gap-2">
        <li>
          <button type="button" onClick={() => onPick(null)} aria-pressed={selected === null} className={clsx("flex w-full items-center gap-3 rounded-2xl border p-4 text-start hover:bg-surface", selected === null ? "border-ink ring-1 ring-ink" : "border-line")}>
            <span className="grid size-12 place-items-center rounded-full bg-surface">
              <Users className="size-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-bold">כל איש מקצוע זמין</span>
              <span className="block text-sm text-muted">הכי הרבה מועדים פנויים</span>
            </span>
          </button>
        </li>
        {pros.map((p) => {
          const r = proRating(db, p.id);
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)} aria-pressed={selected === p.id} className={clsx("flex w-full items-center gap-3 rounded-2xl border p-4 text-start hover:bg-surface", selected === p.id ? "border-ink ring-1 ring-ink" : "border-line")}>
                <Avatar src={p.avatar} name={p.name} size={48} />
                <span className="flex-1">
                  <span className="block font-bold">{p.name}</span>
                  <span className="block text-sm text-muted">
                    {p.title}
                    {r.count > 0 && <span className="num"> · ★ {r.avg.toFixed(1)}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Date strip + time grid computed from hours, duration, buffer, breaks, appointments and blocked time. */
export function SlotPicker({
  db,
  businessId,
  serviceId,
  professionalId,
  date,
  selected,
  onDate,
  onPick,
  excludeAppointmentId,
  durationMin,
}: {
  db: DB;
  businessId: ID;
  serviceId: ID;
  professionalId: ID | null;
  date?: string;
  selected?: string;
  onDate: (d: string) => void;
  onPick: (start: string) => void;
  excludeAppointmentId?: ID;
  durationMin?: number;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const days = useMemo(() => availableDays(db, { businessId, serviceId, professionalId }, 21, now), [db, businessId, serviceId, professionalId, now]);
  const firstOpen = days.find((d) => d.count > 0)?.date;
  const active = date && days.some((d) => d.date === date) ? date : firstOpen;
  useEffect(() => {
    if (active && active !== date) onDate(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const slots = useMemo(() => (active ? getSlots(db, { businessId, serviceId, date: active, professionalId, excludeAppointmentId, durationMin }, now) : []), [db, businessId, serviceId, active, professionalId, excludeAppointmentId, durationMin, now]);
  const groups = [
    ["בוקר", slots.filter((s) => local(s.start).hour < 12)],
    ["צהריים", slots.filter((s) => local(s.start).hour >= 12 && local(s.start).hour < 17)],
    ["ערב", slots.filter((s) => local(s.start).hour >= 17)],
  ] as const;
  return (
    <section>
      <h2 className="mb-3 text-xl font-black">מתי נוח לך?</h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="radiogroup" aria-label="תאריך">
        {days.map((d) => {
          const dt = DateTime.fromISO(d.date, { zone: TZ });
          const on = d.date === active;
          return (
            <button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={d.count === 0}
              onClick={() => onDate(d.date)}
              aria-label={`${fmtDate(dt.toISO()!)}${d.count ? `, ${d.count} מועדים` : ", אין מועדים"}`}
              className={clsx("flex h-[72px] w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-sm transition disabled:opacity-35", on ? "border-ink bg-ink text-ink-inverse" : "border-line hover:bg-surface")}
            >
              <span className="text-xs">{WEEKDAYS_SHORT[dt.weekday % 7]}</span>
              <span className="num text-lg font-bold">{dt.day}</span>
              <span className={clsx("size-1 rounded-full", d.count ? (on ? "bg-ink-inverse" : "bg-ok") : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </div>
      {!firstOpen ? (
        <EmptyState title="אין מועדים פנויים ב־3 השבועות הקרובים" text="נסו איש מקצוע אחר או שלחו הודעה לעסק." />
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {active && <p className="text-sm font-semibold">{fmtDate(DateTime.fromISO(active, { zone: TZ }).toISO()!)}</p>}
          {groups.map(([label, list]) =>
            list.length ? (
              <div key={label}>
                <h3 className="mb-2 text-xs font-semibold text-muted">{label}</h3>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={`שעות ${label}`}>
                  {list.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      role="radio"
                      aria-checked={selected === s.start}
                      onClick={() => onPick(s.start)}
                      className={clsx("num h-11 rounded-xl border text-sm font-semibold transition", selected === s.start ? "border-ink bg-ink text-ink-inverse" : "border-line hover:bg-surface")}
                    >
                      {fmtTime(s.start)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          {slots.length === 0 && <p className="rounded-2xl bg-surface p-4 text-sm text-muted">אין מועדים ביום הזה. בחרו יום אחר.</p>}
        </div>
      )}
    </section>
  );
}

function InspirationStep({ db, businessId, draft }: { db: DB; businessId: ID; draft: BookingDraft }) {
  const me = useMe();
  const savedIds = new Set(db.collections.filter((c) => c.userId === me?.id).flatMap((c) => c.postIds));
  const candidates = useMemo(() => {
    const own = db.posts.filter((p) => p.businessId === businessId && p.status === "published");
    const saved = db.posts.filter((p) => savedIds.has(p.id) && p.status === "published" && p.businessId !== businessId);
    const src = draft.sourcePostId ? db.posts.filter((p) => p.id === draft.sourcePostId) : [];
    return [...new Map([...src, ...saved, ...own].map((p) => [p.id, p])).values()].slice(0, 18);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, businessId, draft.sourcePostId, me?.id]);
  const toggle = (id: ID) => {
    const on = draft.inspirationPostIds.includes(id);
    if (!on && draft.inspirationPostIds.length >= 6) return;
    setDraft({ inspirationPostIds: on ? draft.inspirationPostIds.filter((x) => x !== id) : [...draft.inspirationPostIds, id] });
  };
  return (
    <section>
      <h2 className="text-xl font-black">השראה והערה</h2>
      <p className="mb-3 mt-1 text-sm text-muted">בחרו עד 6 תמונות שהעסק יראה עם התור. {me ? "מוצגות עבודות העסק והשמורים שלך." : "התחברו כדי להוסיף גם מהשמורים."}</p>
      <ul className="grid grid-cols-3 gap-2">
        {candidates.map((p) => (
          <li key={p.id}>
            <InspirationTile post={p} on={draft.inspirationPostIds.includes(p.id)} source={p.id === draft.sourcePostId} onToggle={() => toggle(p.id)} />
          </li>
        ))}
      </ul>
      <label htmlFor="bk-note" className="mt-6 block text-sm font-semibold">
        הערה לעסק (לא חובה)
      </label>
      <Textarea id="bk-note" className="mt-1.5" maxLength={300} placeholder="למשל: אורך השיער, רגישויות, משהו שחשוב לדעת" value={draft.note} onChange={(e) => setDraft({ note: e.target.value })} />
      <p className="mt-1 text-end text-xs text-muted">{draft.note.length}/300</p>
    </section>
  );
}

function InspirationTile({ post, on, source, onToggle }: { post: Post; on: boolean; source: boolean; onToggle: () => void }) {
  const url = useMediaUrl(post.cover ?? post.media[0]?.poster ?? post.media[0]?.src);
  return (
    <button type="button" onClick={onToggle} aria-pressed={on} aria-label={`${on ? "הסרת" : "בחירת"} השראה: ${post.caption.slice(0, 40)}`} className={clsx("relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface", on && "ring-[3px] ring-ink ring-offset-2 ring-offset-bg")}>
      {url && <img src={url} alt="" className="media size-full object-cover" loading="lazy" />}
      {source && <span className="absolute start-1.5 top-1.5 rounded-full bg-white/90 px-2 text-[10px] font-bold text-[#111]">מהפוסט שראית</span>}
      <span className={clsx("absolute bottom-1.5 end-1.5 grid size-6 place-items-center rounded-full", on ? "bg-ink text-ink-inverse" : "border-2 border-white bg-black/20")}>{on && <Check className="size-4" aria-hidden />}</span>
    </button>
  );
}

function ReviewStep({ db, draft, service }: { db: DB; draft: BookingDraft; service: Service }) {
  const b = db.businesses.find((x) => x.id === draft.businessId)!;
  const pro = draft.professionalId ? db.professionals.find((p) => p.id === draft.professionalId) : null;
  const dep = depositFor(service);
  const rows: [string, React.ReactNode][] = [
    ["עסק", b.name],
    ["שירות", `${service.name} · ${duration(service.durationMin)}`],
    ["איש מקצוע", pro?.name ?? "כל איש מקצוע זמין (ישובץ אוטומטית)"],
    ["מועד", fmtDateTime(draft.start!)],
    ["כתובת", b.isMobile ? `שירות נייד — הכתובת תתואם עם העסק` : b.address],
  ];
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-black">סיכום</h2>
      <dl className="divide-y divide-line rounded-2xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 p-4 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="text-end font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-2xl bg-surface p-4">
        <div className="flex justify-between text-sm">
          <span>מחיר {service.priceFrom ? "(החל מ־)" : ""}</span>
          <span className="num font-bold">{price(service.price)}</span>
        </div>
        {dep > 0 ? (
          <>
            <div className="mt-2 flex justify-between text-sm">
              <span>מקדמה לתשלום עכשיו (דמו)</span>
              <span className="num font-bold">{price(dep)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-muted">
              <span>יתרה לתשלום בעסק</span>
              <span className="num">{service.priceFrom ? "החל מ־" : ""}{price(Math.max(0, service.price - dep))}</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">התשלום מתבצע בעסק. לא נדרש תשלום עכשיו.</p>
        )}
        <p className="mt-3 text-xs text-muted">המחיר נשמר ברגע ההזמנה — שינויי מחיר עתידיים לא ישפיעו על התור הזה.</p>
      </div>
      <div className="flex gap-3 rounded-2xl border border-line p-4 text-sm">
        {service.approval === "manual" ? <Hourglass className="size-5 shrink-0" aria-hidden /> : <CheckCircle2 className="size-5 shrink-0" aria-hidden />}
        <div>
          <div className="font-semibold">{service.approval === "manual" ? "השירות דורש אישור העסק" : "אישור מיידי"}</div>
          <p className="mt-0.5 text-muted">
            {service.approval === "manual"
              ? `המועד נשמר עבורך עד ${b.policy.requestExpiryHours} שעות. אם העסק לא יגיב — הבקשה תפוג והמועד ישוחרר.${dep ? " אחרי האישור תתבקש/י לשלם מקדמה." : ""}`
              : dep
                ? `המועד יישמר ${b.policy.paymentHoldMinutes} דקות לתשלום המקדמה.`
                : "התור ייקבע מיד אחרי האישור."}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-line p-4 text-sm">
        <div className="font-semibold">מדיניות ביטול</div>
        <p className="mt-0.5 text-muted">{b.policy.text}</p>
      </div>
      {draft.inspirationPostIds.length > 0 && <p className="text-sm text-muted">מצורפות {draft.inspirationPostIds.length} תמונות השראה{draft.note ? " והערה" : ""}.</p>}
    </section>
  );
}

function BookingDone({ appointmentId }: { appointmentId: ID }) {
  const db = useApp((s) => s.db);
  const a = db.appointments.find((x) => x.id === appointmentId);
  const [pay, setPay] = useState(a?.status === "pending_payment");
  if (!a) return null;
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  const pro = db.professionals.find((x) => x.id === a.professionalId);
  const title = a.status === "confirmed" ? "התור נקבע!" : a.status === "pending_approval" ? "הבקשה נשלחה" : a.status === "pending_payment" ? "נשאר רק לשלם מקדמה" : STATUS_LABEL[a.status];
  return (
    <>
      <TopBar title="קביעת תור" />
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
        <span className={clsx("grid size-20 place-items-center rounded-full", a.status === "confirmed" ? "bg-ok-soft text-ok" : "bg-surface")}>
          {a.status === "confirmed" ? <Check className="size-10" aria-hidden /> : a.status === "pending_payment" ? <CreditCard className="size-9" aria-hidden /> : <Hourglass className="size-9" aria-hidden />}
        </span>
        <h1 className="animate-pop text-3xl font-black">{title}</h1>
        <p className="text-muted">
          {a.snapshot.serviceName} ב{b.name}
          <br />
          {fmtDateTime(a.start)} · אצל {pro?.name}
        </p>
        {a.status === "pending_approval" && <p className="rounded-2xl bg-surface p-4 text-sm">נעדכן אותך בהתראה באפליקציה ברגע שהעסק יאשר או ידחה. תוקף הבקשה עד {fmtDateTime(a.holdExpiresAt!)}.</p>}
        {a.status === "pending_payment" && (
          <Button size="lg" className="w-full" onClick={() => setPay(true)}>
            תשלום מקדמה {price(a.snapshot.deposit)} (דמו)
          </Button>
        )}
        <div className="flex w-full flex-col gap-2">
          <LinkButton to={`/appointments/${a.id}`} variant={a.status === "pending_payment" ? "secondary" : "primary"} size="lg">
            לפרטי התור
          </LinkButton>
          <LinkButton to="/" variant="ghost">
            חזרה לפיד
          </LinkButton>
        </div>
        <p className="text-xs text-muted">ההתראות בדמו מוצגות באפליקציה בלבד — לא נשלחים SMS, אימייל או התראות פוש.</p>
      </div>
      <DemoPaymentSheet open={pay} onClose={() => setPay(false)} appointment={a} />
    </>
  );
}

/** Simulated deposit payment. Never asks for card details. */
export function DemoPaymentSheet({ open, onClose, appointment: a }: { open: boolean; onClose: () => void; appointment: Appointment }) {
  const [busy, setBusy] = useState<"success" | "failure" | null>(null);
  const [failed, setFailed] = useState(false);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!open || !a.holdExpiresAt) return;
    const tick = () => setLeft(Math.max(0, Date.parse(a.holdExpiresAt!) - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [open, a.holdExpiresAt]);
  const run = async (outcome: "success" | "failure") => {
    setBusy(outcome);
    await DemoPayments.chargeDeposit({ amount: a.snapshot.deposit, outcome });
    const r = payDeposit(a.id, outcome);
    setBusy(null);
    if (!r) return;
    if (outcome === "failure") setFailed(true);
    else {
      setFailed(false);
      onClose();
    }
  };
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  return (
    <Sheet open={open} onClose={onClose} title="תשלום מקדמה">
      <div className="flex flex-col gap-4">
        <DemoLabel className="self-start">תשלום דמו — לא נגבה כסף ולא נאספים פרטי כרטיס</DemoLabel>
        <div className="rounded-2xl bg-surface p-4">
          <div className="flex justify-between">
            <span>מקדמה</span>
            <span className="num text-xl font-black">{price(a.snapshot.deposit)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm text-muted">
            <span>יתרה בעסק</span>
            <span className="num">{price(Math.max(0, a.snapshot.price - a.snapshot.deposit))}</span>
          </div>
        </div>
        {a.holdExpiresAt && (
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <Clock className="size-4" aria-hidden /> המועד שמור עבורך עוד <span className="num font-bold">{left > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : "0:00"}</span>
          </p>
        )}
        {failed && (
          <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">
            התשלום (המדומה) נכשל. המועד עדיין שמור — אפשר לנסות שוב.
          </p>
        )}
        <Button size="lg" loading={busy === "success"} disabled={!!busy || left === 0} onClick={() => run("success")}>
          אישור תשלום (דמו)
        </Button>
        <Button variant="secondary" loading={busy === "failure"} disabled={!!busy || left === 0} onClick={() => run("failure")}>
          סימולציית כשל בתשלום
        </Button>
        <p className="text-xs leading-relaxed text-muted">בגרסה אמיתית התשלום יתבצע אצל ספק סליקה מאובטח (דף תשלום מתארח), והאישור יגיע מהשרת. Beautigo לא תשמור פרטי כרטיס.</p>
      </div>
    </Sheet>
  );
}
