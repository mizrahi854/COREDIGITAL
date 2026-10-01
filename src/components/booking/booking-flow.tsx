"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { ArrowRight, Check, Clock, ImagePlus, Info, MapPin, Sparkles, Users, Wallet } from "lucide-react";
import clsx from "clsx";
import { ApiError, apiFetch, newIdempotencyKey } from "@/lib/client";
import { formatDuration, formatPrice } from "@/lib/format";
import { Avatar, Badge, Button, Card, Textarea } from "../ui";
import { useToast } from "../toast";
import { useViewer } from "../viewer";
import { SlotPicker, type Slot } from "./slot-picker";

type Service = { id: string; name: string; description: string; priceAgorot: number; durationMin: number; mode: "FIXED" | "CONSULTATION"; staffIds: string[] };
type Staff = { id: string; name: string; title: string; avatarUrl: string | null };
type MiniReel = { id: string; thumbUrl: string | null; caption: string; businessName?: string };

export function BookingFlow(props: {
  business: { id: string; slug: string; name: string; address: string; avatarUrl: string | null; cancellationPolicy: string; timezone: string; isDemo: boolean };
  services: Service[];
  staff: Staff[];
  initial: { serviceId: string | null; staffId: string | null; date: string | null; time: string | null };
  sourceReel: MiniReel | null;
  savedReels: MiniReel[];
  signedIn: boolean;
}) {
  const { business, services, staff, sourceReel } = props;
  const router = useRouter();
  const toast = useToast();
  const { requireAuth } = useViewer();

  const [serviceId, setServiceId] = useState<string | null>(
    props.initial.serviceId && services.some((s) => s.id === props.initial.serviceId) ? props.initial.serviceId : null,
  );
  const [staffChoice, setStaffId] = useState<string | null>(props.initial.staffId);
  const [date, setDate] = useState<string | null>(props.initial.date);
  const [slot, setSlot] = useState<Slot | null>(props.initial.time ? { start: props.initial.time, end: "", staffIds: [] } : null);
  const [notes, setNotes] = useState("");
  const [inspo, setInspo] = useState<string[]>(sourceReel ? [sourceReel.id] : []);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingService, setEditingService] = useState(!serviceId);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = useMemo(() => staff.filter((s) => service?.staffIds.includes(s.id)), [staff, service]);
  // A staff choice that cannot perform the selected service falls back to "anyone available".
  const staffId = staffChoice && service?.staffIds.includes(staffChoice) ? staffChoice : null;


  // One idempotency key per concrete booking attempt; a double-click or retry reuses it.
  const idemKey = useRef(newIdempotencyKey());
  useEffect(() => {
    idemKey.current = newIdempotencyKey();
  }, [serviceId, staffId, slot?.start]);

  // Keep the selection in the URL so sign-in and refresh do not lose it.
  useEffect(() => {
    const q = new URLSearchParams();
    if (serviceId) q.set("service", serviceId);
    if (staffId) q.set("staff", staffId);
    if (sourceReel) q.set("reel", sourceReel.id);
    if (date) q.set("date", date);
    if (slot) q.set("time", slot.start);
    window.history.replaceState(null, "", `?${q}`);
  }, [serviceId, staffId, date, slot, sourceReel]);

  const daysUrl = service ? `/api/availability/days?businessId=${business.id}&serviceId=${service.id}${staffId ? `&staffId=${staffId}` : ""}` : null;
  const slotsUrl = useCallback(
    (d: string) => (service ? `/api/availability?businessId=${business.id}&serviceId=${service.id}&date=${d}${staffId ? `&staffId=${staffId}` : ""}` : null),
    [business.id, service, staffId],
  );

  const isConsult = service?.mode === "CONSULTATION";
  const when = slot ? DateTime.fromISO(slot.start).setZone(business.timezone).setLocale("he") : null;
  const assigned = staffId ? staff.find((s) => s.id === staffId) : null;
  const ready = !!(service && slot);

  const submit = async () => {
    if (!service || !slot) return;
    if (!requireAuth("כדי לקבוע תור צריך חשבון — כך העסק יודע מי מגיע/ה ותוכלו לנהל את התור.")) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: string; status: string }>("/api/appointments", {
        body: {
          businessId: business.id,
          serviceId: service.id,
          staffId,
          startsAt: slot.start,
          notes: notes || undefined,
          inspirationReelIds: inspo,
          sourceReelId: sourceReel?.id ?? null,
          idempotencyKey: idemKey.current,
        },
      });
      router.push(`/appointments/${res.id}?new=1`);
    } catch (e) {
      const err = e as ApiError;
      toast({ kind: "error", text: err.message });
      if (err.code === "slot_unavailable") {
        setSlot(null);
        setRefreshKey((k) => k + 1);
      }
      setSubmitting(false);
    }
  };

  const allInspo: MiniReel[] = [...(sourceReel ? [sourceReel] : []), ...props.savedReels.filter((r) => r.id !== sourceReel?.id)];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href={`/b/${business.slug}`} className="grid size-11 shrink-0 place-items-center rounded-full bg-paper shadow-[var(--shadow-soft)]" aria-label="חזרה לפרופיל העסק">
          <ArrowRight className="size-5" />
        </Link>
        <Avatar src={business.avatarUrl} name={business.name} size={44} />
        <div className="min-w-0">
          <p className="text-xs text-muted">קביעת תור ב־</p>
          <h1 className="truncate text-xl font-bold">{business.name}</h1>
        </div>
        {business.isDemo && <Badge className="ms-auto">עסק לדוגמה</Badge>}
      </header>

      {sourceReel && (
        <Card className="flex items-center gap-3 p-3">
          {sourceReel.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sourceReel.thumbUrl} alt="" className="h-16 w-12 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0 text-sm">
            <div className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="size-4 text-bronze" aria-hidden /> הגעת מסרטון
            </div>
            <p className="line-clamp-1 text-muted">{sourceReel.caption}</p>
            <p className="text-xs text-muted">הסרטון יצורף לתור כהשראה. אפשר לשנות שירות.</p>
          </div>
        </Card>
      )}

      {/* 1. Service */}
      <Step n={1} title="שירות" done={!!service && !editingService}>
        {service && !editingService ? (
          <Summary onEdit={() => setEditingService(true)}>
            <span className="font-semibold">{service.name}</span>
            <span className="text-muted">
              {" · "}
              <span className="ltr-nums">{formatPrice(service.priceAgorot, { from: isConsult })}</span> · {formatDuration(service.durationMin)}
            </span>
          </Summary>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted">לעסק אין כרגע שירותים פתוחים להזמנה.</p>
        ) : (
          <ul className="flex flex-col gap-2" role="radiogroup" aria-label="בחירת שירות">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={s.id === serviceId}
                  onClick={() => {
                    setServiceId(s.id);
                    setSlot(null);
                    setEditingService(false);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition",
                    s.id === serviceId ? "border-ink bg-paper" : "border-line bg-paper hover:bg-sand/60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {s.name}
                      {s.mode === "CONSULTATION" && <Badge tone="warn">מחיר בתיאום</Badge>}
                    </div>
                    {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{s.description}</p>}
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                      <Clock className="size-3.5" aria-hidden /> {formatDuration(s.durationMin)}
                    </p>
                  </div>
                  <span className="ltr-nums shrink-0 font-semibold">{formatPrice(s.priceAgorot, { from: s.mode === "CONSULTATION" })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Step>

      {/* 2. Staff */}
      <Step n={2} title="איש/אשת צוות" done={!!service} disabled={!service}>
        {service && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="radiogroup" aria-label="בחירת איש צוות">
            <StaffChip on={!staffId} onClick={() => { setStaffId(null); setSlot(null); }} name="כל מי שפנוי/ה" icon />
            {eligibleStaff.map((s) => (
              <StaffChip key={s.id} on={staffId === s.id} onClick={() => { setStaffId(s.id); setSlot(null); }} name={s.name} sub={s.title} avatarUrl={s.avatarUrl} />
            ))}
          </div>
        )}
      </Step>

      {/* 3. Date & time */}
      <Step n={3} title={isConsult ? "מועד מועדף" : "תאריך ושעה"} done={!!slot} disabled={!service}>
        {service && (
          <>
            {isConsult && (
              <p className="mb-3 flex gap-2 rounded-2xl bg-warn-soft p-3 text-sm text-warn">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                זה שירות בתיאום: בחרו מועד מועדף. העסק יחזור עם מחיר ומועד סופיים, והתור יאושר רק אחרי שתאשרו את ההצעה.
              </p>
            )}
            <SlotPicker
              timezone={business.timezone}
              daysUrl={daysUrl}
              slotsUrl={slotsUrl}
              date={date}
              onDate={(d) => {
                if (d !== date) setSlot(null);
                setDate(d);
              }}
              value={slot?.start ?? null}
              onChange={setSlot}
              refreshKey={refreshKey}
            />
          </>
        )}
      </Step>

      {/* 4. Inspiration & notes */}
      <Step n={4} title="השראה והערות" optional disabled={!service}>
        {service && (
          <div className="flex flex-col gap-4">
            {allInspo.length > 0 ? (
              <div>
                <p className="mb-2 text-sm text-muted">בחרו עד 6 השראות מהשמורים שלכם. השראה עוזרת להבין מה תרצו — היא לא הבטחה לתוצאה זהה.</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {allInspo.map((r) => {
                    const on = inspo.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${on ? "הסרת" : "צירוף"} השראה: ${r.caption || r.businessName || "סרטון"}`}
                        onClick={() => setInspo((all) => (on ? all.filter((x) => x !== r.id) : all.length < 6 ? [...all, r.id] : all))}
                        className={clsx("relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition", on ? "border-ink" : "border-transparent opacity-80 hover:opacity-100")}
                      >
                        {r.thumbUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.thumbUrl} alt="" className="size-full object-cover" />
                        )}
                        {on && (
                          <span className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-ink text-cream">
                            <Check className="size-4" aria-hidden />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <ImagePlus className="size-4" aria-hidden /> שמרו סרטונים מהפיד כדי לצרף אותם כהשראה.
              </p>
            )}
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="משהו שחשוב שהעסק ידע? (אורך, גוון, רגישויות…)" aria-label="הערות לעסק" maxLength={500} />
          </div>
        )}
      </Step>

      {/* 5. Review */}
      {ready && service && when && (
        <section aria-labelledby="review-title" className="animate-rise">
          <h2 id="review-title" className="mb-3 text-lg font-semibold">
            סיכום {isConsult ? "הבקשה" : "התור"}
          </h2>
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{service.name}</div>
                <div className="text-sm text-muted">{assigned ? `עם ${assigned.name}` : "עם מי שפנוי/ה במועד הזה"}</div>
              </div>
              <div className="text-end">
                <div className="ltr-nums text-xl font-bold">{formatPrice(service.priceAgorot, { from: isConsult })}</div>
                {isConsult && <div className="text-xs text-warn">מחיר סופי ייקבע ע״י העסק</div>}
              </div>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row icon={<Clock className="size-4" />} label="מועד">
                {when.toFormat("cccc, d בLLLL")} · <span className="ltr-nums">{when.toFormat("HH:mm")}</span> ({formatDuration(service.durationMin)})
              </Row>
              <Row icon={<MapPin className="size-4" />} label="כתובת">{business.address}</Row>
              <Row icon={<Wallet className="size-4" />} label="תשלום">בעסק, במועד הטיפול</Row>
              <Row icon={<Users className="size-4" />} label="השראות">{inspo.length ? `${inspo.length} מצורפות` : "ללא"}</Row>
            </dl>
            <div className="rounded-2xl bg-sand/60 p-3 text-sm">
              <span className="font-semibold">מדיניות ביטול: </span>
              <span className="text-ink-2">{business.cancellationPolicy}</span>
            </div>
          </Card>
        </section>
      )}

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:bottom-0 md:ps-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            {service ? (
              <>
                <div className="truncate font-semibold">{service.name}</div>
                <div className="truncate text-muted">
                  {when ? (
                    <>
                      {when.toFormat("ccc d/M")} · <span className="ltr-nums">{when.toFormat("HH:mm")}</span>
                    </>
                  ) : (
                    "בחרו מועד"
                  )}
                </div>
              </>
            ) : (
              <span className="text-muted">בחרו שירות כדי להתחיל</span>
            )}
          </div>
          <Button size="lg" onClick={submit} disabled={!ready} loading={submitting} className="shrink-0">
            {isConsult ? "שליחת בקשה" : "אישור וקביעה"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children, done, disabled, optional }: { n: number; title: string; children: React.ReactNode; done?: boolean; disabled?: boolean; optional?: boolean }) {
  return (
    <section aria-labelledby={`step-${n}`} className={clsx("transition", disabled && "opacity-50")}>
      <h2 id={`step-${n}`} className="mb-3 flex items-center gap-2.5 text-lg font-semibold">
        <span className={clsx("grid size-7 place-items-center rounded-full text-sm", done ? "bg-ink text-cream" : "bg-sand text-ink-2")}>
          {done ? <Check className="size-4" aria-hidden /> : n}
        </span>
        {title}
        {optional && <span className="text-sm font-normal text-muted">(לא חובה)</span>}
      </h2>
      {children}
    </section>
  );
}

function Summary({ children, onEdit }: { children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-4">
      <div className="min-w-0 text-[15px]">{children}</div>
      <button type="button" onClick={onEdit} className="shrink-0 text-sm font-semibold text-bronze-ink underline underline-offset-4">
        שינוי
      </button>
    </div>
  );
}

function StaffChip({ on, onClick, name, sub, avatarUrl, icon }: { on: boolean; onClick: () => void; name: string; sub?: string; avatarUrl?: string | null; icon?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={clsx("flex h-16 shrink-0 items-center gap-3 rounded-2xl border px-4 text-start transition", on ? "border-ink bg-paper" : "border-line bg-paper hover:bg-sand/60")}
    >
      {icon ? (
        <span className="grid size-10 place-items-center rounded-full bg-bronze-soft text-bronze-ink">
          <Users className="size-5" aria-hidden />
        </span>
      ) : (
        <Avatar src={avatarUrl} name={name} size={40} />
      )}
      <span>
        <span className="block text-sm font-semibold">{name}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
    </button>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-bronze-ink" aria-hidden>
        {icon}
      </span>
      <div>
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}
