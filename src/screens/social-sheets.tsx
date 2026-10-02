import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Check, Flag, FolderPlus, LogIn, Send, ShieldOff } from "lucide-react";
import type { ID, Post, ReportTarget } from "../domain/types";
import { fmtRelative } from "../domain/time";
import { addComment, blockBusiness, isSaved, report, savePost, unsavePost } from "../store/actions";
import { gate, toast, useApp, useMe } from "../store/app";
import { Avatar, Button, Input, LinkButton, Textarea } from "../ui/kit";
import { Sheet } from "../ui/overlays";

export const REPORT_REASONS = ["תוכן לא הולם", "ספאם או הונאה", "שימוש בתמונה ללא רשות", "הטעיה במחיר או בשירות", "הטרדה", "אחר"];

/** Shown when a guest tries an action that needs an account. */
export function AuthPromptSheet() {
  const prompt = useApp((s) => s.authPrompt);
  const loc = useLocation();
  const close = () => useApp.setState({ authPrompt: null });
  const next = encodeURIComponent(prompt?.next ?? loc.pathname + loc.search);
  return (
    <Sheet open={!!prompt} onClose={close} title="נדרש חשבון">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-surface">
          <LogIn className="size-6" aria-hidden />
        </span>
        <p className="text-[15px] leading-relaxed text-muted">{prompt?.reason}</p>
        <LinkButton to={`/signin?next=${next}`} size="lg" className="w-full" onClick={close}>
          התחברות או הרשמה
        </LinkButton>
        <Button variant="ghost" onClick={close}>
          להמשיך לגלוש
        </Button>
      </div>
    </Sheet>
  );
}

export function CommentsSheet({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }) {
  const db = useApp((s) => s.db);
  const me = useMe();
  const [text, setText] = useState("");
  const [reportId, setReportId] = useState<ID | null>(null);
  const comments = db.comments.filter((c) => c.postId === post.id && !c.hidden && !me?.blockedUserIds.includes(c.userId));
  const business = db.businesses.find((b) => b.id === post.businessId);
  const send = () => {
    if (!gate("כדי להגיב צריך חשבון.")) return;
    if (addComment(post.id, text)) setText("");
  };
  return (
    <Sheet open={open} onClose={onClose} title={`תגובות (${comments.length})`}>
      <ul className="mb-4 flex max-h-[45dvh] flex-col gap-4 overflow-y-auto">
        {comments.length === 0 && <li className="py-6 text-center text-sm text-muted">עוד אין תגובות. אפשר לשאול את העסק שאלה על העבודה.</li>}
        {comments.map((c) => {
          const u = db.users.find((x) => x.id === c.userId);
          const isBiz = u?.businessId === post.businessId && u?.role === "business";
          return (
            <li key={c.id} className="flex gap-3">
              <Avatar src={isBiz ? business?.avatar : undefined} name={isBiz ? business!.name : u?.name ?? "משתמש/ת"} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{isBiz ? business!.name : u?.name}</span>
                  {isBiz && <span className="rounded-full bg-surface px-2 text-[11px] font-semibold">העסק</span>}
                  <span className="text-xs text-muted">{fmtRelative(c.createdAt)}</span>
                </div>
                <p className="text-[15px] leading-snug">{c.text}</p>
              </div>
              {me && c.userId !== me.id && (
                <button type="button" className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface" aria-label="דיווח על התגובה" onClick={() => setReportId(c.id)}>
                  <Flag className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={me ? "הוספת תגובה…" : "התחברו כדי להגיב"} aria-label="תגובה" maxLength={500} />
        <Button type="submit" disabled={!text.trim()} aria-label="שליחת תגובה" className="w-12 shrink-0 px-0">
          <Send className="size-5 flip-rtl" />
        </Button>
      </form>
      <ReportSheet open={!!reportId} onClose={() => setReportId(null)} targetType="comment" targetId={reportId ?? ""} />
    </Sheet>
  );
}

export function SaveSheet({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }) {
  const db = useApp((s) => s.db);
  const me = useMe();
  const [name, setName] = useState("");
  const cols = db.collections.filter((c) => c.userId === me?.id);
  return (
    <Sheet open={open} onClose={onClose} title="שמירה לאוסף">
      <ul className="mb-4 flex flex-col gap-2">
        {cols.map((c) => {
          const on = c.postIds.includes(post.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => (on ? unsavePost(post.id, c.id) : savePost(post.id, c.id))}
                className="flex h-14 w-full items-center justify-between rounded-2xl border border-line px-4 text-start hover:bg-surface"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {c.postIds.length} פריטים
                  <span className={on ? "grid size-6 place-items-center rounded-full bg-ink text-ink-inverse" : "size-6 rounded-full border-2 border-line"}>{on && <Check className="size-4" aria-hidden />}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (savePost(post.id, "new", name)) {
            setName("");
            toast("ok", "נוסף לאוסף החדש");
          }
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="אוסף חדש, למשל ״השראה לחתונה״" aria-label="שם אוסף חדש" maxLength={40} />
        <Button type="submit" disabled={!name.trim()} className="shrink-0">
          <FolderPlus className="size-4" aria-hidden /> יצירה
        </Button>
      </form>
      {cols.length > 0 && isSaved(db, me?.id ?? null, post.id) && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => (unsavePost(post.id), onClose())}>
          הסרה מכל האוספים
        </Button>
      )}
    </Sheet>
  );
}

export function ReportSheet({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: ReportTarget; targetId: ID }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="דיווח">
      <fieldset className="mb-3 flex flex-col gap-2">
        <legend className="mb-2 text-sm text-muted">הדיווח יועבר לצוות Beautigo לבדיקה. העסק לא יודע מי דיווח.</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex h-12 cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 has-[:checked]:border-ink">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[#111]" />
            {r}
          </label>
        ))}
      </fieldset>
      <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="פרטים נוספים (לא חובה)" aria-label="פרטים נוספים" maxLength={500} />
      <Button
        className="mt-3 w-full"
        size="lg"
        disabled={!reason}
        onClick={() => {
          if (report(targetType, targetId, reason, details) !== undefined) {
            toast("ok", "הדיווח התקבל. תודה!");
            setReason("");
            setDetails("");
            onClose();
          }
        }}
      >
        שליחת דיווח
      </Button>
    </Sheet>
  );
}

export function PostMoreSheet({ post, open, onClose, onReport }: { post: Post; open: boolean; onClose: () => void; onReport: () => void }) {
  const navigate = useNavigate();
  const db = useApp((s) => s.db);
  const b = useMemo(() => db.businesses.find((x) => x.id === post.businessId)!, [db, post.businessId]);
  const item = "flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-start font-medium hover:bg-surface";
  return (
    <Sheet open={open} onClose={onClose} title="אפשרויות">
      <button type="button" className={item} onClick={() => (onClose(), navigate(`/b/${b.id}`))}>
        לפרופיל של {b.name}
      </button>
      <button type="button" className={item} onClick={() => gate("כדי לדווח על תוכן צריך חשבון.") && (onClose(), onReport())}>
        <Flag className="size-5 text-bad" aria-hidden /> דיווח על התוכן
      </button>
      <button
        type="button"
        className={item}
        onClick={() => {
          if (!gate("כדי לחסום עסק צריך חשבון.")) return;
          if (blockBusiness(b.id) !== undefined) {
            toast("ok", `${b.name} נחסם. אפשר לבטל בהגדרות > חשבונות חסומים.`);
            onClose();
          }
        }}
      >
        <ShieldOff className="size-5 text-muted" aria-hidden /> חסימת {b.name}
      </button>
    </Sheet>
  );
}
