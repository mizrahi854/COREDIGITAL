import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ImagePlus, Star, X } from "lucide-react";
import clsx from "clsx";
import { mediaStore } from "../data/repository";
import { fmtDateTime } from "../domain/time";
import { canReview, submitReview } from "../store/actions";
import { toast, useApp, useMe } from "../store/app";
import { useMediaUrl } from "../ui/hooks";
import { Button, EmptyState, LinkButton, Textarea } from "../ui/kit";
import { Page, TopBar } from "../ui/shell";

const LABELS = ["", "גרוע", "לא משהו", "בסדר", "טוב מאוד", "מושלם"];

export function ReviewScreen() {
  const { appointmentId } = useParams();
  const db = useApp((s) => s.db);
  const me = useMe();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const photoUrl = useMediaUrl(photo);
  const a = db.appointments.find((x) => x.id === appointmentId);
  if (!a || !canReview(db, me?.id ?? null, a.id))
    return (
      <>
        <TopBar title="ביקורת" back />
        <Page>
          <EmptyState
            title="אי אפשר לכתוב ביקורת על התור הזה"
            text="ביקורות נכתבות רק על תור שלך שהושלם, ופעם אחת בלבד לכל תור."
            action={<LinkButton to="/appointments">לתורים שלי</LinkButton>}
          />
        </Page>
      </>
    );
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  const pro = db.professionals.find((x) => x.id === a.professionalId);
  return (
    <>
      <TopBar title="ביקורת" back />
      <Page className="max-w-lg">
        <h1 className="text-2xl font-black">איך היה ב{b.name}?</h1>
        <p className="mt-1 text-sm text-muted">
          {a.snapshot.serviceName} אצל {pro?.name} · {fmtDateTime(a.start)}
        </p>
        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rating) return toast("error", "בחרו דירוג");
            if (submitReview(a.id, { rating, text, photo })) {
              toast("ok", "תודה! הביקורת פורסמה");
              navigate(`/b/${b.id}?tab=reviews`, { replace: true });
            }
          }}
        >
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">דירוג</legend>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="דירוג בכוכבים">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} כוכבים — ${LABELS[n]}`} onClick={() => setRating(n)} className="grid size-12 place-items-center rounded-full hover:bg-surface">
                  <Star className={clsx("size-8 transition", n <= rating ? "fill-ink text-ink" : "text-line")} aria-hidden />
                </button>
              ))}
              <span className="ms-2 text-sm font-semibold">{LABELS[rating]}</span>
            </div>
          </fieldset>
          <div>
            <label htmlFor="rv-text" className="text-sm font-semibold">
              ספרו עוד (לא חובה)
            </label>
            <Textarea id="rv-text" className="mt-1.5" maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה אהבתם? מה אפשר לשפר?" />
          </div>
          <div>
            <span className="text-sm font-semibold">תמונה של התוצאה (לא חובה)</span>
            {photoUrl ? (
              <div className="relative mt-2 w-32">
                <img src={photoUrl} alt="התמונה שנבחרה" className="h-40 w-32 rounded-xl object-cover" />
                <button type="button" onClick={() => setPhoto(undefined)} className="absolute -end-2 -top-2 grid size-8 place-items-center rounded-full bg-ink text-ink-inverse" aria-label="הסרת התמונה">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="mt-2 flex h-24 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm text-muted hover:bg-surface">
                <ImagePlus className="size-5" aria-hidden /> בחירת תמונה
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 8 * 1024 * 1024) return toast("error", "התמונה גדולה מדי (עד 8MB)");
                    setBusy(true);
                    setPhoto(await mediaStore.put(f));
                    setBusy(false);
                  }}
                />
              </label>
            )}
          </div>
          <p className="text-xs text-muted">הביקורת תוצג עם שמך ועם תג ״ביקורת מתור שהושלם״. העסק יוכל להגיב אך לא למחוק.</p>
          <Button type="submit" size="lg" disabled={!rating} loading={busy}>
            פרסום ביקורת
          </Button>
        </form>
      </Page>
    </>
  );
}
