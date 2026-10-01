"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { CalendarClock, Check, ImagePlus, Star, XCircle } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { formatDuration, formatPrice } from "@/lib/format";
import { Button, Card, Textarea } from "../ui";
import { Sheet } from "../sheet";
import { useToast } from "../toast";
import { SlotPicker, type Slot } from "./slot-picker";

type MiniReel = { id: string; thumbUrl: string | null; caption: string };

export function AppointmentActions({
  appointment: a,
  inspirations,
  savedReels,
}: {
  appointment: {
    id: string;
    status: string;
    startsAt: string;
    businessId: string;
    serviceId: string | null;
    staffId: string;
    timezone: string;
    cancellationHours: number;
    canChange: boolean;
    active: boolean;
    hasReview: boolean;
    proposal: { startsAt: string; priceAgorot: number; durationMin: number; staffName: string; note: string | null } | null;
  };
  inspirations: MiniReel[];
  savedReels: MiniReel[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"cancel" | "reschedule" | "inspo" | null>(null);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [selected, setSelected] = useState(inspirations.map((i) => i.id));
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const run = async (key: string, url: string, body: object, ok: string) => {
    setBusy(key);
    try {
      await apiFetch(url, { body });
      toast({ kind: "ok", text: ok });
      setSheet(null);
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const slotsUrl = useCallback(
    (d: string) => (a.serviceId ? `/api/availability?businessId=${a.businessId}&serviceId=${a.serviceId}&date=${d}&staffId=${a.staffId}&exclude=${a.id}` : null),
    [a],
  );

  const p = a.proposal;
  const pWhen = p ? DateTime.fromISO(p.startsAt).setZone(a.timezone).setLocale("he") : null;
  const pool = [...inspirations, ...savedReels.filter((r) => !inspirations.some((i) => i.id === r.id))];

  return (
    <div className="mt-4 flex flex-col gap-4">
      {p && pWhen && (
        <Card className="border-2 border-warn/30 p-5">
          <h2 className="text-lg font-semibold">העסק שלח הצעה</h2>
          <p className="mt-1 text-sm text-muted">התור יאושר רק אחרי שתאשרו. המועד נבדק שוב בזמן האישור.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">מועד</dt>
              <dd className="font-semibold">
                {pWhen.toFormat("cccc d בLLLL")} · <span className="ltr-nums">{pWhen.toFormat("HH:mm")}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">מחיר סופי</dt>
              <dd className="ltr-nums text-start font-semibold">{formatPrice(p.priceAgorot)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">משך</dt>
              <dd className="font-semibold">{formatDuration(p.durationMin)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">עם</dt>
              <dd className="font-semibold">{p.staffName}</dd>
            </div>
          </dl>
          {p.note && <p className="mt-3 rounded-2xl bg-sand/60 p-3 text-sm">״{p.note}״</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => run("accept", `/api/appointments/${a.id}/accept`, {}, "התור אושר!")} loading={busy === "accept"} className="flex-1">
              <Check className="size-4" aria-hidden /> אישור ההצעה
            </Button>
            <Button variant="secondary" onClick={() => run("decline", `/api/appointments/${a.id}/decline-proposal`, {}, "ההצעה נדחתה")} loading={busy === "decline"}>
              דחייה
            </Button>
          </div>
        </Card>
      )}

      {a.active && (
        <div className="flex flex-wrap gap-2">
          {a.status === "CONFIRMED" && (
            <Button variant="secondary" onClick={() => setSheet("reschedule")} disabled={!a.canChange}>
              <CalendarClock className="size-4" aria-hidden /> שינוי מועד
            </Button>
          )}
          <Button variant="secondary" onClick={() => setSheet("inspo")}>
            <ImagePlus className="size-4" aria-hidden /> השראות ({inspirations.length})
          </Button>
          <Button variant="danger" onClick={() => setSheet("cancel")} disabled={a.status === "CONFIRMED" && !a.canChange}>
            <XCircle className="size-4" aria-hidden /> {a.status === "CONFIRMED" ? "ביטול התור" : "ביטול הבקשה"}
          </Button>
        </div>
      )}
      {a.active && a.status === "CONFIRMED" && !a.canChange && (
        <p className="text-sm text-muted">
          עברנו את חלון השינויים ({a.cancellationHours} שעות לפני התור). לשינוי או ביטול יש לפנות ישירות לעסק.
        </p>
      )}

      {inspirations.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">השראות מצורפות</h2>
          <div className="flex gap-2">
            {inspirations.map((r) => (
              <a key={r.id} href={`/reel/${r.id}`} className="block h-24 w-16 overflow-hidden rounded-xl bg-sand" aria-label={r.caption || "השראה"}>
                {r.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbUrl} alt="" className="size-full object-cover" />
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {a.status === "COMPLETED" && !a.hasReview && (
        <Card className="p-5">
          <h2 className="font-semibold">איך היה?</h2>
          <p className="mb-3 text-sm text-muted">הביקורת תופיע בפרופיל העסק עם השם הפרטי שלך.</p>
          <div className="mb-3 flex gap-1" role="radiogroup" aria-label="דירוג">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} כוכבים`} onClick={() => setRating(n)} className="grid size-11 place-items-center rounded-full hover:bg-sand">
                <Star className={clsx("size-7", n <= rating ? "fill-bronze text-bronze" : "text-line")} />
              </button>
            ))}
          </div>
          <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="ספרו בכמה מילים (לא חובה)" aria-label="טקסט הביקורת" maxLength={1000} />
          <Button className="mt-3" disabled={!rating} loading={busy === "review"} onClick={() => run("review", `/api/appointments/${a.id}/review`, { rating, text: reviewText }, "תודה על הביקורת!")}>
            פרסום ביקורת
          </Button>
        </Card>
      )}

      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)} title={a.status === "CONFIRMED" ? "לבטל את התור?" : "לבטל את הבקשה?"}>
        <p className="mb-3 text-sm text-ink-2">המועד ישוחרר מיד ללקוחות אחרים.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבה (לא חובה) — עוזר לעסק" aria-label="סיבת ביטול" maxLength={300} />
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" loading={busy === "cancel"} onClick={() => run("cancel", `/api/appointments/${a.id}/cancel`, { reason: reason || undefined }, "התור בוטל")}>
            כן, לבטל
          </Button>
          <Button variant="secondary" onClick={() => setSheet(null)}>
            השארת התור
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === "reschedule"} onClose={() => setSheet(null)} title="בחירת מועד חדש" className="md:max-w-2xl">
        <p className="mb-4 text-sm text-muted">התור הנוכחי נשמר עד שהמועד החדש מאושר. אם המועד תפוס — שום דבר לא משתנה.</p>
        <SlotPicker timezone={a.timezone} slotsUrl={slotsUrl} date={date} onDate={(d) => { setDate(d); setSlot(null); }} value={slot?.start ?? null} onChange={setSlot} days={21} />
        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={!slot}
          loading={busy === "reschedule"}
          onClick={() => slot && run("reschedule", `/api/appointments/${a.id}/reschedule`, { startsAt: slot.start }, "המועד עודכן")}
        >
          אישור המועד החדש
        </Button>
      </Sheet>

      <Sheet open={sheet === "inspo"} onClose={() => setSheet(null)} title="השראות לתור">
        {pool.length === 0 ? (
          <p className="text-sm text-muted">אין עדיין סרטונים שמורים. שמרו סרטונים מהפיד כדי לצרף אותם.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {pool.map((r) => {
              const on = selected.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={r.caption || "סרטון"}
                  onClick={() => setSelected((all) => (on ? all.filter((x) => x !== r.id) : all.length < 6 ? [...all, r.id] : all))}
                  className={clsx("relative aspect-[3/4] overflow-hidden rounded-xl border-2", on ? "border-ink" : "border-transparent opacity-75")}
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
        )}
        <Button size="lg" className="mt-4 w-full" loading={busy === "inspo"} onClick={() => run("inspo", `/api/appointments/${a.id}/inspiration`, { reelIds: selected }, "ההשראות עודכנו")}>
          שמירה
        </Button>
      </Sheet>
    </div>
  );
}
