import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatDateTime, mediaUrl } from "@/lib/format";
import { Badge, Card, EmptyState, Logo } from "@/components/ui";
import { AdminAction } from "@/components/admin-action";

const TABS = [
  ["businesses", "עסקים"],
  ["reports", "דיווחים"],
  ["content", "תוכן"],
  ["appointments", "בעיות בתורים"],
  ["log", "יומן פעולות"],
  ["outbox", "יומן משלוחים"],
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "businesses";
  const counts = await Promise.all([
    prisma.business.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:pt-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-lg">
            <Logo />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">ניהול מערכת</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-muted hover:text-ink">
          חזרה לאפליקציה
        </Link>
      </div>
      <nav className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="אזורי ניהול">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/admin?tab=${key}`} aria-current={tab === key ? "page" : undefined} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium ${tab === key ? "bg-ink text-cream" : "border border-line bg-paper"}`}>
            {label}
            {key === "businesses" && counts[0] > 0 && <span className="grid size-5 place-items-center rounded-full bg-bronze-ink text-[11px] text-white">{counts[0]}</span>}
            {key === "reports" && counts[1] > 0 && <span className="grid size-5 place-items-center rounded-full bg-bad text-[11px] text-white">{counts[1]}</span>}
          </Link>
        ))}
      </nav>
      {tab === "businesses" && <Businesses />}
      {tab === "reports" && <Reports />}
      {tab === "content" && <Content />}
      {tab === "appointments" && <Appointments />}
      {tab === "log" && <Log />}
      {tab === "outbox" && <Outbox />}
    </main>
  );
}

async function Businesses() {
  const list = await prisma.business.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { members: { where: { role: "OWNER" }, include: { user: { select: { name: true, email: true } } } }, _count: { select: { reels: true, services: true, appointments: true } } },
  });
  return (
    <ul className="flex flex-col gap-3">
      {list.map((b) => (
        <li key={b.id}>
          <Card className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/b/${b.slug}`} className="font-semibold hover:underline">
                  {b.name}
                </Link>
                <Badge tone={b.status === "APPROVED" ? "ok" : b.status === "PENDING_REVIEW" ? "warn" : "bad"}>
                  {b.status === "APPROVED" ? "מאושר" : b.status === "PENDING_REVIEW" ? "ממתין לבדיקה" : "מושעה"}
                </Badge>
                {b.verified && <Badge tone="bronze">מאומת</Badge>}
                {b.isDemo && <Badge>דמו</Badge>}
              </div>
              <div className="text-sm text-muted">
                {b.categories.map((c) => CATEGORY_LABEL[c]).join(", ")} · {b.city} · בעלים: {b.members[0]?.user.name} ({b.members[0]?.user.email})
              </div>
              <div className="text-xs text-muted">
                {b._count.services} שירותים · {b._count.reels} רילס · {b._count.appointments} תורים
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.status !== "APPROVED" && <AdminAction kind="business" id={b.id} action="approve" label="אישור" variant="primary" />}
              {b.status !== "SUSPENDED" && <AdminAction kind="business" id={b.id} action="suspend" label="השעיה" variant="danger" askNote="סיבת ההשעיה:" />}
              {b.verified ? (
                <AdminAction kind="business" id={b.id} action="unverify" label="ביטול אימות" />
              ) : (
                <AdminAction kind="business" id={b.id} action="verify" label="סימון כמאומת" askNote="מה נבדק? (חובה לתעד)" />
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

async function Reports() {
  const reports = await prisma.report.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { reporter: { select: { name: true } } }, take: 100 });
  const reelIds = reports.filter((r) => r.targetType === "REEL").map((r) => r.targetId);
  const bizIds = reports.filter((r) => r.targetType === "BUSINESS").map((r) => r.targetId);
  const [reels, bizs] = await Promise.all([
    prisma.reel.findMany({ where: { id: { in: reelIds } }, select: { id: true, caption: true, thumbPath: true, hiddenByAdmin: true, business: { select: { name: true } } } }),
    prisma.business.findMany({ where: { id: { in: bizIds } }, select: { id: true, name: true, slug: true } }),
  ]);
  if (!reports.length) return <EmptyState title="אין דיווחים" />;
  return (
    <ul className="flex flex-col gap-3">
      {reports.map((r) => {
        const reel = reels.find((x) => x.id === r.targetId);
        const biz = bizs.find((x) => x.id === r.targetId);
        return (
          <li key={r.id}>
            <Card className="flex flex-wrap items-start gap-4 p-4">
              {reel?.thumbPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(reel.thumbPath)!} alt="" className="h-24 w-16 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.reason}</span>
                  <Badge tone={r.status === "OPEN" ? "warn" : "neutral"}>{r.status === "OPEN" ? "פתוח" : r.status === "RESOLVED" ? "טופל" : "נדחה"}</Badge>
                  {reel?.hiddenByAdmin && <Badge tone="bad">מוסתר</Badge>}
                </div>
                <div className="text-sm text-muted">
                  {r.targetType === "REEL" ? `רילס של ${reel?.business.name ?? "—"}: ״${reel?.caption ?? ""}״` : `עסק: ${biz?.name ?? "—"}`}
                </div>
                {r.details && <p className="mt-1 text-sm">{r.details}</p>}
                <div className="mt-1 text-xs text-muted">
                  דווח ע״י {r.reporter.name} · {formatDateTime(r.createdAt)}
                  {r.resolution && ` · החלטה: ${r.resolution}`}
                </div>
              </div>
              {r.status === "OPEN" && (
                <div className="flex flex-wrap gap-2">
                  {r.targetType === "REEL" && <AdminAction kind="report" id={r.id} action="hide_target" label="הסתרת התוכן" variant="danger" askNote="הסבר שיוצג לעסק:" />}
                  {r.targetType === "BUSINESS" && <AdminAction kind="report" id={r.id} action="suspend_target" label="השעיית העסק" variant="danger" askNote="סיבה:" />}
                  <AdminAction kind="report" id={r.id} action="resolve" label="טופל" askNote="מה נעשה?" />
                  <AdminAction kind="report" id={r.id} action="dismiss" label="דחיית הדיווח" variant="ghost" />
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

async function Content() {
  const reels = await prisma.reel.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { business: { select: { name: true } } } });
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {reels.map((r) => (
        <li key={r.id}>
          <Card className="overflow-hidden">
            <div className="relative aspect-[9/14] bg-sand">
              {r.thumbPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(r.thumbPath)!} alt="" className="size-full object-cover" />
              )}
              <div className="absolute start-2 top-2 flex flex-col gap-1">
                <Badge tone={r.status === "PUBLISHED" ? "ok" : r.status === "FAILED" ? "bad" : "neutral"}>{r.status}</Badge>
                {r.hiddenByAdmin && <Badge tone="bad">מוסתר</Badge>}
              </div>
            </div>
            <div className="flex flex-col gap-2 p-2.5 text-xs">
              <span className="truncate font-semibold">{r.business.name}</span>
              {r.hiddenByAdmin ? (
                <AdminAction kind="reel" id={r.id} action="unhide" label="החזרה" />
              ) : (
                <AdminAction kind="reel" id={r.id} action="hide" label="הסתרה" variant="danger" askNote="סיבת ההסתרה (תוצג לעסק):" />
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

async function Appointments() {
  const since = DateTime.now().minus({ days: 14 }).toJSDate();
  const [staleRequests, businessCancels, noShows] = await Promise.all([
    prisma.appointment.findMany({ where: { status: "REQUESTED", createdAt: { lt: DateTime.now().minus({ hours: 48 }).toJSDate() } }, include: { business: { select: { name: true } } }, take: 50 }),
    prisma.appointment.findMany({ where: { status: "CANCELLED", cancelledBy: "business", cancelledAt: { gte: since } }, include: { business: { select: { name: true } } }, take: 50 }),
    prisma.appointment.findMany({ where: { status: "NO_SHOW", startsAt: { gte: since } }, include: { business: { select: { name: true } } }, take: 50 }),
  ]);
  return (
    <>
      <Section title="בקשות שלא נענו מעל 48 שעות" hint="לקוחות שמחכים להצעה מהעסק." list={staleRequests} />
      <Section title="ביטולים ע״י עסקים (14 יום)" hint="ריבוי ביטולים עשוי להצביע על בעיה." list={businessCancels} />
      <Section title="אי־הגעה (14 יום)" hint="לבדיקת מחלוקות." list={noShows} />
    </>
  );
}

type ApptIssue = Awaited<ReturnType<typeof prisma.appointment.findMany<{ include: { business: { select: { name: true } } } }>>>[number];

function Section({ title, list, hint }: { title: string; hint: string; list: ApptIssue[] }) {
  return (
    <section className="mb-8">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-muted">{hint}</p>
      {list.length === 0 ? (
        <p className="text-sm text-muted">אין.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="flex-1">
                  <b>{a.business.name}</b> · {a.serviceName} · {formatDateTime(a.startsAt)} · {STATUS_LABEL[a.status]}
                  {a.cancelReason && <span className="text-muted"> · {a.cancelReason}</span>}
                </span>
                {["REQUESTED", "CONFIRMED", "PROPOSED"].includes(a.status) && (
                  <AdminAction kind="appointment" id={a.id} action="cancel" label="ביטול ע״י המערכת" variant="danger" askNote="הסבר ללקוח/ה:" />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Log() {
  const log = await prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { admin: { select: { name: true } } } });
  if (!log.length) return <EmptyState title="עוד אין פעולות" />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="p-3 text-start">מתי</th>
            <th className="p-3 text-start">מי</th>
            <th className="p-3 text-start">פעולה</th>
            <th className="p-3 text-start">יעד</th>
            <th className="p-3 text-start">הערה</th>
          </tr>
        </thead>
        <tbody>
          {log.map((l) => (
            <tr key={l.id} className="border-b border-line/60">
              <td className="p-3">{formatDateTime(l.createdAt)}</td>
              <td className="p-3">{l.admin.name}</td>
              <td className="p-3 font-medium">{l.action}</td>
              <td className="p-3 text-muted">
                {l.targetType} · <span className="ltr-nums">{l.targetId.slice(-6)}</span>
              </td>
              <td className="p-3">{l.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

async function Outbox() {
  const list = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <p className="mb-4 rounded-2xl bg-warn-soft p-4 text-sm text-warn">
        אין כרגע ספק אימייל/SMS מוגדר. הודעות מסומנות ״נרשם ביומן״ <b>לא נשלחו בפועל</b> — הן מוצגות כאן לבדיקה בלבד.
      </p>
      <ul className="flex flex-col gap-2">
        {list.map((n) => (
          <li key={n.id}>
            <Card className="p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{n.subject}</span>
                <Badge tone={n.status === "SENT" ? "ok" : n.status === "LOGGED" ? "neutral" : n.status === "PENDING" ? "warn" : "bad"}>
                  {n.status === "LOGGED" ? "נרשם ביומן — לא נשלח" : n.status === "PENDING" ? "ממתין" : n.status === "SENT" ? "נשלח" : n.status === "CANCELLED" ? "בוטל" : "נכשל"}
                </Badge>
                <span className="text-xs text-muted">
                  {n.channel} → <span className="ltr-nums">{n.recipient}</span> · מתוזמן ל־{formatDateTime(n.scheduledFor)}
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-[inherit] text-xs text-ink-2">{n.body}</pre>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
