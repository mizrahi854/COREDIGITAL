import { BarChart3, CalendarDays, ClipboardList, Images, Megaphone, Scissors, Settings, Star, Users, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { DateTime } from "luxon";
import { TZ, fmtShortDate, fmtTime } from "../../domain/time";
import { price } from "../../domain/format";
import { calendarLabel } from "../../integrations/googleCalendar";
import { Badge, LinkButton, SectionTitle } from "../../ui/kit";
import { Page, TopBar } from "../../ui/shell";
import { StatusBadge } from "../appointments";
import { customerName, NavRow, StatCard, useBiz } from "./common";

export function ManageHome() {
  const { db, me, business: b, isStaff, appointments } = useBiz();
  const today = DateTime.now().setZone(TZ).toISODate()!;
  const todays = appointments.filter((a) => DateTime.fromISO(a.start).setZone(TZ).toISODate() === today && ["confirmed", "completed", "pending_payment"].includes(a.status)).sort((x, y) => x.start.localeCompare(y.start));
  const pending = appointments.filter((a) => a.status === "pending_approval").sort((x, y) => x.start.localeCompare(y.start));
  const upcoming = appointments.filter((a) => a.status === "confirmed" && Date.parse(a.start) > Date.now()).length;
  const monthStart = DateTime.now().setZone(TZ).startOf("month").toISO()!;
  const revenue = appointments.filter((a) => a.status === "completed" && a.start >= monthStart).reduce((s, a) => s + a.snapshot.price, 0);
  const openIntegration = db.integrationEvents.filter((e) => e.businessId === b.id && !e.resolved).length;

  return (
    <>
      <TopBar title={isStaff ? "היומן שלי" : "ניהול"} sub={b.name} large />
      <Page>
        {isStaff && <p className="mb-4 rounded-2xl bg-surface p-3 text-sm text-muted">שלום {me.name.split(" ")[0]}! כחבר/ת צוות יש לך גישה רק ליומן ולתורים שלך. שירותים, מחירים ונתונים מנוהלים על ידי בעלת העסק.</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="תורים היום" value={todays.length} />
          <StatCard label="בקשות ממתינות" value={pending.length} hint={pending.length ? "דורש תגובה" : "הכול מטופל"} />
          <StatCard label="תורים קרובים" value={upcoming} />
          {!isStaff && <StatCard label="הכנסות החודש (הערכה)" value={price(revenue)} hint="לפי מחיר בתורים שהושלמו · דמו" />}
        </div>

        {pending.length > 0 && (
          <section className="mt-6">
            <SectionTitle action={<Link to="/manage/appointments?f=pending_approval" className="text-sm font-semibold underline">הכול</Link>}>ממתינים לאישור</SectionTitle>
            <ul className="flex flex-col gap-2">
              {pending.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link to={`/manage/appointments/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft/40 p-3 hover:bg-warn-soft">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{customerName(db, a)} · {a.snapshot.serviceName}</div>
                      <div className="num text-sm text-muted">
                        {fmtShortDate(a.start)} {fmtTime(a.start)} · פג ב־{a.holdExpiresAt ? `${fmtShortDate(a.holdExpiresAt)} ${fmtTime(a.holdExpiresAt)}` : "—"}
                      </div>
                    </div>
                    <StatusBadge a={a} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <SectionTitle action={<LinkButton to="/manage/calendar" size="sm" variant="secondary">ליומן</LinkButton>}>היום</SectionTitle>
          {todays.length === 0 ? (
            <p className="rounded-2xl bg-surface p-4 text-sm text-muted">אין תורים היום.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todays.map((a) => (
                <li key={a.id}>
                  <Link to={`/manage/appointments/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-surface">
                    <span className="num w-12 font-bold">{fmtTime(a.start)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{customerName(db, a)}</span>
                      <span className="block truncate text-sm text-muted">
                        {a.snapshot.serviceName} · {db.professionals.find((p) => p.id === a.professionalId)?.name}
                      </span>
                    </span>
                    <StatusBadge a={a} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 grid gap-2 sm:grid-cols-2">
          <NavRow to="/manage/calendar" icon={<CalendarDays className="size-5" />} label="יומן" />
          <NavRow to="/manage/appointments" icon={<ClipboardList className="size-5" />} label="תורים ובקשות" meta={pending.length ? <Badge tone="warn">{pending.length}</Badge> : undefined} />
          {!isStaff && (
            <>
              <NavRow to="/manage/customers" icon={<UsersRound className="size-5" />} label="לקוחות" />
              <NavRow to="/manage/services" icon={<Scissors className="size-5" />} label="שירותים ומחירים" />
              <NavRow to="/manage/staff" icon={<Users className="size-5" />} label="צוות, שעות והפסקות" />
              <NavRow to="/manage/content" icon={<Images className="size-5" />} label="תוכן" />
              <NavRow to="/manage/analytics" icon={<BarChart3 className="size-5" />} label="נתונים" />
              <NavRow to="/manage/reviews" icon={<Star className="size-5" />} label="ביקורות" />
              <NavRow to="/manage/promote" icon={<Megaphone className="size-5" />} label="קידום (קונספט)" />
              <NavRow
                to="/manage/settings"
                icon={<Settings className="size-5" />}
                label="הגדרות עסק ו־Google Calendar"
                meta={<Badge tone={b.calendar.status === "error" || openIntegration ? "bad" : b.calendar.status === "connected" ? "ok" : "outline"}>{calendarLabel(b.calendar)}</Badge>}
              />
            </>
          )}
        </section>
      </Page>
    </>
  );
}
