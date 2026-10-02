import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CalendarDays, Flag, MessageCircle, MoreHorizontal, Send, ShieldOff } from "lucide-react";
import clsx from "clsx";
import type { Conversation, DB, User } from "../domain/types";
import { fmtDateTime, fmtRelative, fmtTime } from "../domain/time";
import { blockConversation, conversationAccess, markConversationRead, sendMessage } from "../store/actions";
import { toast, useApp, useMe } from "../store/app";
import { useMediaUrl } from "../ui/hooks";
import { Avatar, Button, EmptyState, IconButton, Input, LinkButton } from "../ui/kit";
import { Sheet } from "../ui/overlays";
import { Page, TopBar } from "../ui/shell";
import { ReportSheet } from "./social-sheets";
import { StatusBadge } from "./appointments";

function counterpart(db: DB, me: User, c: Conversation) {
  if (me.id === c.customerId) {
    const b = db.businesses.find((x) => x.id === c.businessId)!;
    return { name: b.name, avatar: b.avatar, link: `/b/${b.id}` };
  }
  const u = db.users.find((x) => x.id === c.customerId);
  return { name: u?.name ?? "לקוח/ה", avatar: u?.avatar, link: `/manage/customers/${c.customerId}` };
}

export function MessagesScreen() {
  const db = useApp((s) => s.db);
  const me = useMe();
  const list = useMemo(
    () =>
      me
        ? db.conversations
            .filter((c) => conversationAccess(db, me, c.id))
            .sort((a, b) => (b.messages.at(-1)?.createdAt ?? b.createdAt).localeCompare(a.messages.at(-1)?.createdAt ?? a.createdAt))
        : [],
    [db, me],
  );
  if (!me)
    return (
      <>
        <TopBar title="הודעות" large />
        <Page>
          <EmptyState title="התחברו כדי לשלוח הודעות" action={<LinkButton to="/signin?next=/messages">התחברות</LinkButton>} />
        </Page>
      </>
    );
  return (
    <>
      <TopBar title="הודעות" large />
      <Page className="max-w-2xl">
        {me.role === "staff" && <p className="mb-3 rounded-2xl bg-surface p-3 text-sm text-muted">שיחות עם לקוחות מנוהלות על ידי בעלת העסק. לצוות יש גישה ליומן ולתורים בלבד.</p>}
        {list.length === 0 ? (
          <EmptyState icon={<MessageCircle className="size-6" aria-hidden />} title="אין שיחות עדיין" text="אפשר לשלוח הודעה לעסק מהפרופיל שלו או מתור קיים." />
        ) : (
          <ul className="flex flex-col">
            {list.map((c) => {
              const other = counterpart(db, me, c);
              const last = c.messages.at(-1);
              const unread = !!last && last.senderId !== me.id && (!c.lastReadAt[me.id] || c.lastReadAt[me.id] < last.createdAt);
              const a = c.appointmentId ? db.appointments.find((x) => x.id === c.appointmentId) : undefined;
              return (
                <li key={c.id}>
                  <Link to={`/messages/${c.id}`} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-surface">
                    <Avatar src={other.avatar} name={other.name} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx("truncate", unread ? "font-black" : "font-semibold")}>{other.name}</span>
                        {last && <span className="shrink-0 text-xs text-muted">{fmtRelative(last.createdAt)}</span>}
                      </div>
                      <div className={clsx("truncate text-sm", unread ? "font-semibold text-ink" : "text-muted")}>
                        {last ? `${last.senderId === me.id ? "את/ה: " : ""}${last.text || "צירף/ה השראה"}` : "שיחה חדשה"}
                      </div>
                      {a && <div className="truncate text-xs text-muted">בנושא: {a.snapshot.serviceName}</div>}
                    </div>
                    {unread && <span className="size-2.5 shrink-0 rounded-full bg-ink" aria-label="לא נקרא" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Page>
    </>
  );
}

export function ConversationScreen() {
  const { id } = useParams();
  const db = useApp((s) => s.db);
  const me = useMe();
  const [text, setText] = useState("");
  const [more, setMore] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const c = me && id ? conversationAccess(db, me, id) : null;
  const count = c?.messages.length ?? 0;
  useEffect(() => {
    if (c) markConversationRead(c.id);
    endRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, count]);
  if (!me || !c)
    return (
      <>
        <TopBar title="שיחה" back="/messages" />
        <Page>
          <EmptyState title="השיחה לא זמינה" text="ייתכן שאין לך גישה לשיחה הזו." action={<LinkButton to="/messages">לכל ההודעות</LinkButton>} />
        </Page>
      </>
    );
  const other = counterpart(db, me, c);
  const b = db.businesses.find((x) => x.id === c.businessId)!;
  const isBiz = me.id !== c.customerId;
  const a = c.appointmentId ? db.appointments.find((x) => x.id === c.appointmentId) : undefined;
  const send = (t: string, attach?: string) => {
    if (sendMessage(c.id, t, attach) !== undefined) setText("");
  };
  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col lg:min-h-dvh">
      <TopBar
        title={<Link to={other.link}>{other.name}</Link>}
        back="/messages"
        actions={
          <IconButton label="אפשרויות שיחה" onClick={() => setMore(true)}>
            <MoreHorizontal className="size-5" />
          </IconButton>
        }
      />
      {a && (
        <Link to={isBiz ? `/manage/appointments/${a.id}` : `/appointments/${a.id}`} className="mx-auto mt-2 flex w-[calc(100%-2rem)] max-w-2xl items-center gap-3 rounded-2xl border border-line p-3 text-sm hover:bg-surface">
          <CalendarDays className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{a.snapshot.serviceName}</span>
            <span className="num block text-muted">{fmtDateTime(a.start)}</span>
          </span>
          <StatusBadge a={a} />
        </Link>
      )}
      <ol className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-4 py-4" aria-live="polite">
        {c.messages.length === 0 && <li className="py-10 text-center text-sm text-muted">כתבו את ההודעה הראשונה ל{other.name}.</li>}
        {c.messages.map((m) => {
          const mine = m.senderId === me.id;
          return (
            <li key={m.id} className={clsx("flex max-w-[80%] flex-col gap-1", mine ? "self-start items-start" : "self-end items-end")}>
              {m.attachmentPostId && <AttachedPost db={db} postId={m.attachmentPostId} />}
              {m.text && <div className={clsx("rounded-[20px] px-4 py-2.5 text-[15px] leading-snug", mine ? "bg-ink text-ink-inverse" : "bg-surface")}>{m.text}</div>}
              <span className="num text-[11px] text-muted">{fmtTime(m.createdAt)}</span>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mx-auto w-full max-w-2xl px-3 pb-2 lg:bottom-0 lg:pb-4">
        {c.blockedBy ? (
          <div className="glass rounded-2xl p-3 text-center text-sm">
            {c.blockedBy === me.id ? (
              <>
                חסמת את השיחה.{" "}
                <button type="button" className="font-semibold underline" onClick={() => blockConversation(c.id, false)}>
                  ביטול חסימה
                </button>
              </>
            ) : (
              "לא ניתן לשלוח הודעות בשיחה הזו."
            )}
          </div>
        ) : (
          <>
            {isBiz && b.quickReplies.length > 0 && (
              <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
                {b.quickReplies.map((q) => (
                  <button key={q} type="button" onClick={() => setText(q)} className="glass h-9 shrink-0 rounded-full px-3.5 text-sm">
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              className="glass flex gap-2 rounded-[24px] p-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="הודעה…" aria-label="הודעה" maxLength={1000} className="border-0 bg-transparent" />
              <Button type="submit" disabled={!text.trim()} aria-label="שליחה" className="w-12 shrink-0 px-0">
                <Send className="flip-rtl size-5" />
              </Button>
            </form>
          </>
        )}
      </div>
      <Sheet open={more} onClose={() => setMore(false)} title="אפשרויות">
        <button type="button" className="flex h-14 w-full items-center gap-3 rounded-2xl px-4 font-medium hover:bg-surface" onClick={() => (setMore(false), setReportOpen(true))}>
          <Flag className="size-5 text-bad" aria-hidden /> דיווח על השיחה
        </button>
        <button
          type="button"
          className="flex h-14 w-full items-center gap-3 rounded-2xl px-4 font-medium hover:bg-surface"
          onClick={() => {
            if (blockConversation(c.id, !c.blockedBy) !== undefined) {
              toast("ok", c.blockedBy ? "החסימה בוטלה" : "השיחה נחסמה");
              setMore(false);
            }
          }}
        >
          <ShieldOff className="size-5 text-muted" aria-hidden /> {c.blockedBy === me.id ? "ביטול חסימה" : "חסימת השיחה"}
        </button>
      </Sheet>
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} targetType="conversation" targetId={c.id} />
    </div>
  );
}

function AttachedPost({ db, postId }: { db: DB; postId: string }) {
  const p = db.posts.find((x) => x.id === postId);
  const url = useMediaUrl(p?.cover ?? p?.media[0]?.poster ?? p?.media[0]?.src);
  if (!p) return <div className="rounded-2xl bg-surface px-3 py-2 text-xs text-muted">ההשראה כבר לא זמינה</div>;
  return (
    <Link to={`/post/${p.id}`} className="block w-36 overflow-hidden rounded-2xl border border-line" aria-label="השראה מצורפת">
      {url && <img src={url} alt="" className="media aspect-[3/4] w-full object-cover" />}
      <span className="block truncate px-2 py-1 text-xs">השראה · {db.businesses.find((b) => b.id === p.businessId)?.name}</span>
    </Link>
  );
}
