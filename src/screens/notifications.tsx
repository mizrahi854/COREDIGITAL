import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Bell, CalendarDays, Heart, MessageCircle, Store } from "lucide-react";
import clsx from "clsx";
import type { NotificationCategory } from "../domain/types";
import { fmtRelative } from "../domain/time";
import { markNotificationsRead } from "../store/actions";
import { useApp, useMe } from "../store/app";
import { Chip, EmptyState, LinkButton } from "../ui/kit";
import { Page, TopBar } from "../ui/shell";

const ICON: Record<NotificationCategory, typeof Bell> = { appointments: CalendarDays, messages: MessageCircle, social: Heart, business: Store };
const LABEL: Record<NotificationCategory, string> = { appointments: "תורים", messages: "הודעות", social: "קהילה", business: "עסק" };

export function NotificationsScreen() {
  const db = useApp((s) => s.db);
  const enabled = useApp((s) => s.settings.notify);
  const me = useMe();
  const [cat, setCat] = useState<NotificationCategory | "all">("all");
  const all = useMemo(() => db.notifications.filter((n) => n.userId === me?.id && enabled[n.category] !== false), [db, me?.id, enabled]);
  // Snapshot unread ids on open so they stay highlighted while viewing
  const [fresh] = useState(() => new Set(all.filter((n) => !n.read).map((n) => n.id)));
  const meId = me?.id;
  useEffect(() => {
    if (meId) markNotificationsRead();
  }, [meId]);
  if (!me)
    return (
      <>
        <TopBar title="התראות" large />
        <Page>
          <EmptyState title="התחברו כדי לקבל התראות" action={<LinkButton to="/signin?next=/notifications">התחברות</LinkButton>} />
        </Page>
      </>
    );
  const list = all.filter((n) => cat === "all" || n.category === cat);
  const cats = [...new Set(all.map((n) => n.category))];
  return (
    <>
      <TopBar title="התראות" large sub="באפליקציה בלבד — בדמו לא נשלחים SMS, אימייל או פוש" />
      <Page className="max-w-2xl">
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            הכול
          </Chip>
          {cats.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {LABEL[c]}
            </Chip>
          ))}
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<Bell className="size-6" aria-hidden />} title="אין התראות" text="כאן יופיעו אישורי תורים, הודעות ופעילות. אפשר לבחור קטגוריות בהגדרות." action={<LinkButton to="/settings" variant="secondary">הגדרות התראות</LinkButton>} />
        ) : (
          <ul className="flex flex-col gap-1">
            {list.map((n) => {
              const Icon = ICON[n.category];
              const body = (
                <>
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.title}</span>
                    <span className="block text-sm text-muted">{n.body}</span>
                    <span className="block text-xs text-muted">{fmtRelative(n.createdAt)}</span>
                  </span>
                  {fresh.has(n.id) && <span className="size-2.5 shrink-0 rounded-full bg-ink" aria-label="חדש" />}
                </>
              );
              const cls = clsx("flex items-center gap-3 rounded-2xl p-3", fresh.has(n.id) && "bg-surface/60", n.link && "hover:bg-surface");
              return <li key={n.id}>{n.link ? <Link to={n.link} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
            })}
          </ul>
        )}
      </Page>
    </>
  );
}
