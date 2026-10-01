import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { ArrowLeft, CalendarCheck2, Eye, Hourglass, MousePointerClick, Play, Store, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatPrice, formatTime, mediaUrl } from "@/lib/format";
import { getBizContext } from "@/server/biz-context";
import { businessAnalytics } from "@/server/analytics";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";

export default async function BizOverview() {
  const ctx = await getBizContext();
  if (ctx.role !== "OWNER") redirect("/biz/calendar");
  const b = ctx.business;
  const tz = b.timezone;
  const dayStart = DateTime.now().setZone(tz).startOf("day");
  const [a, requests, today, setup] = await Promise.all([
    businessAnalytics(b.id, 30),
    prisma.appointment.findMany({
      where: { businessId: b.id, status: { in: ["REQUESTED", "PROPOSED"] } },
      orderBy: { createdAt: "asc" },
      include: { customer: { select: { name: true } } },
      take: 10,
    }),
    prisma.appointment.findMany({
      where: { businessId: b.id, status: { in: ["CONFIRMED", "COMPLETED"] }, startsAt: { gte: dayStart.toJSDate(), lt: dayStart.plus({ days: 1 }).toJSDate() } },
      orderBy: { startsAt: "asc" },
      include: { customer: { select: { name: true } }, staff: { select: { name: true } } },
    }),
    Promise.all([
      prisma.service.count({ where: { businessId: b.id, active: true } }),
      prisma.staffMember.count({ where: { businessId: b.id, active: true } }),
      prisma.reel.count({ where: { businessId: b.id, status: "PUBLISHED" } }),
    ]),
  ]);
  const [svcCount, staffCount, reelCount] = setup;
  const funnel = [
    { label: "צפיות ברילס", value: a.reelViews, icon: Play },
    { label: "כניסות לפרופיל", value: a.profileVisits, icon: Eye },
    { label: "התחלות הזמנה", value: a.bookingStarts, icon: MousePointerClick },
    { label: "תורים מאושרים", value: a.confirmed, icon: CalendarCheck2 },
    { label: "טיפולים שהושלמו", value: a.completed, icon: Store },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{DateTime.now().setZone(tz).setLocale("he").toFormat("cccc, d בLLLL")}</p>
          <h1 className="text-3xl font-bold tracking-tight">שלום, {ctx.user.name.split(" ")[0]}</h1>
        </div>
        <ButtonLink href="/biz/calendar?manual=1">+ תור ידני</ButtonLink>
      </div>

      {(svcCount === 0 || staffCount === 0 || reelCount === 0) && (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-semibold">השלמת הפרופיל</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {[
              [svcCount > 0, "הוספת שירותים עם מחיר ומשך", "/biz/services"],
              [staffCount > 0, "הגדרת צוות ושעות עבודה", "/biz/team"],
              [reelCount > 0, "פרסום רילס ראשון", "/biz/reels"],
            ].map(([done, label, href]) => (
              <li key={String(href)}>
                <Link href={String(href)} className="flex items-center gap-2 hover:underline">
                  <span className={done ? "text-ok" : "text-muted"}>{done ? "✓" : "○"}</span> {label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">30 הימים האחרונים</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {funnel.map((f) => (
            <Card key={f.label} className="p-4">
              <f.icon className="mb-3 size-5 text-bronze-ink" aria-hidden />
              <div className="ltr-nums text-2xl font-bold">{f.value.toLocaleString("he-IL")}</div>
              <div className="text-xs text-muted">{f.label}</div>
            </Card>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <CalendarCheck2 className="size-4" aria-hidden /> ערך צפוי מתורים שנקבעו
            </div>
            <div className="ltr-nums mt-1 text-3xl font-bold">{formatPrice(a.expectedValueAgorot)}</div>
            <p className="mt-1 text-xs text-muted">סכום המחירים שסוכמו בתורים מאושרים — לא כסף שהתקבל.</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Wallet className="size-4" aria-hidden /> תשלומים שנרשמו בפועל
            </div>
            <div className="ltr-nums mt-1 text-3xl font-bold text-ok">{formatPrice(a.paidAgorot)}</div>
            <p className="mt-1 text-xs text-muted">רק תשלומים שסימנתם בעת סיום טיפול (תשלום בעסק).</p>
          </Card>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Hourglass className="size-5 text-warn" aria-hidden /> בקשות שמחכות לך
          </h2>
          {requests.length === 0 ? (
            <EmptyState title="אין בקשות פתוחות" text="בקשות לשירותים בתיאום מחיר יופיעו כאן." />
          ) : (
            <ul className="flex flex-col gap-2">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/biz/appointments/${r.id}`} className="flex items-center gap-3 rounded-2xl bg-paper p-4 shadow-[var(--shadow-soft)] hover:bg-sand/40">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{r.serviceName}</div>
                      <div className="text-sm text-muted">{r.customer?.name ?? r.guestName}</div>
                    </div>
                    <Badge tone={r.status === "REQUESTED" ? "warn" : "bronze"}>{r.status === "REQUESTED" ? "צריך הצעה" : "ממתין ללקוח"}</Badge>
                    <ArrowLeft className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">היום ביומן</h2>
          {today.length === 0 ? (
            <EmptyState title="אין תורים היום" action={<ButtonLink href="/biz/calendar" variant="secondary">ליומן</ButtonLink>} />
          ) : (
            <ul className="flex flex-col gap-2">
              {today.map((t) => (
                <li key={t.id}>
                  <Link href={`/biz/appointments/${t.id}`} className="flex items-center gap-3 rounded-2xl bg-paper p-3 shadow-[var(--shadow-soft)] hover:bg-sand/40">
                    <span className="ltr-nums w-14 shrink-0 rounded-xl bg-sand py-2 text-center text-sm font-bold">{formatTime(t.startsAt, tz)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.serviceName}</div>
                      <div className="truncate text-sm text-muted">
                        {t.customer?.name ?? t.guestName} · {t.staff.name}
                      </div>
                    </div>
                    {t.status === "COMPLETED" && <Badge tone="ok">הושלם</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-semibold">מאיזה רילס מגיעים תורים</h2>
        <p className="mb-3 text-sm text-muted">ייחוס לפי הסרטון שממנו הלקוח לחץ ״קביעת תור״. {a.fromReels} מתוך {a.confirmed} התורים המאושרים הגיעו מרילס.</p>
        {a.perReel.length === 0 ? (
          <EmptyState title="עוד אין רילס מפורסמים" action={<ButtonLink href="/biz/reels">העלאת רילס</ButtonLink>} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="p-3 text-start font-medium">סרטון</th>
                  <th className="p-3 text-center font-medium">צפיות</th>
                  <th className="p-3 text-center font-medium">לייקים</th>
                  <th className="p-3 text-center font-medium">שמירות</th>
                  <th className="p-3 text-center font-medium">התחלות הזמנה</th>
                  <th className="p-3 text-center font-medium">תורים</th>
                </tr>
              </thead>
              <tbody>
                {a.perReel.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {r.thumbPath && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(r.thumbPath)!} alt="" className="h-12 w-9 rounded-lg object-cover" />
                        )}
                        <span className="line-clamp-2 max-w-64">{r.caption || "ללא כיתוב"}</span>
                      </div>
                    </td>
                    <td className="ltr-nums p-3 text-center">{r.views}</td>
                    <td className="ltr-nums p-3 text-center">{r.likes}</td>
                    <td className="ltr-nums p-3 text-center">{r.saves}</td>
                    <td className="ltr-nums p-3 text-center">{r.bookingStarts}</td>
                    <td className="ltr-nums p-3 text-center font-semibold">{r.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
