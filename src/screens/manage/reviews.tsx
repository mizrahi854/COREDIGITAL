import { useState } from "react";
import { MessageSquareReply } from "lucide-react";
import { ratingOf } from "../../domain/discover";
import { replyToReview } from "../../store/actions";
import { toast } from "../../store/app";
import { Button, Chip, EmptyState, Stars, Textarea } from "../../ui/kit";
import { Page, TopBar } from "../../ui/shell";
import { ReviewCard } from "../business";
import { useBiz } from "./common";

export function BizReviewsScreen() {
  const { db, business: b } = useBiz();
  const [f, setF] = useState<"all" | "unanswered">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const all = db.reviews.filter((r) => r.businessId === b.id);
  const list = all.filter((r) => f === "all" || !r.reply);
  const rating = ratingOf(db, b.id);
  return (
    <>
      <TopBar title="ביקורות" back="/manage" />
      <Page className="max-w-2xl">
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-surface p-4">
          <span className="num text-4xl font-black">{rating.count ? rating.avg.toFixed(1) : "—"}</span>
          <div>
            <Stars value={rating.avg} />
            <p className="text-sm text-muted">{rating.count} ביקורות גלויות</p>
          </div>
        </div>
        <p className="mb-3 text-sm text-muted">ביקורות לא ניתנות למחיקה על ידי העסק. אפשר להגיב בפומבי, או לדווח לצוות Beautigo על ביקורת פוגענית.</p>
        <div className="mb-4 flex gap-2">
          <Chip active={f === "all"} onClick={() => setF("all")}>
            הכול
          </Chip>
          <Chip active={f === "unanswered"} onClick={() => setF("unanswered")}>
            ללא תגובה <span className="num opacity-70">{all.filter((r) => !r.reply).length}</span>
          </Chip>
        </div>
        {list.length === 0 && <EmptyState title="אין ביקורות כאן" />}
        <div className="flex flex-col gap-3">
          {list.map((r) => (
            <ReviewCard
              key={r.id}
              r={r}
              db={db}
              footer={
                open === r.id ? (
                  <form
                    className="mt-3 flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (replyToReview(r.id, text) !== undefined) {
                        toast("ok", "התגובה פורסמה");
                        setOpen(null);
                      }
                    }}
                  >
                    <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-label="תגובה לביקורת" placeholder="תודה על הביקורת…" />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={!text.trim()}>
                        פרסום תגובה
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                        ביטול
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => {
                      setText(r.reply?.text ?? "");
                      setOpen(r.id);
                    }}
                  >
                    <MessageSquareReply className="size-4" aria-hidden /> {r.reply ? "עריכת תגובה" : "תגובה"}
                  </Button>
                )
              }
            />
          ))}
        </div>
      </Page>
    </>
  );
}
