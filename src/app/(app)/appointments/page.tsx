import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/constants";
import { dt, formatDate, formatPrice, formatTime, mediaUrl } from "@/lib/format";
import { getUser } from "@/server/auth";
import { Avatar, Badge, ButtonLink, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "התורים שלי" };

const tone = (s: string) =>
  s === "CONFIRMED" ? "ok" : s === "PROPOSED" ? "warn" : s === "REQUESTED" ? "bronze" : s === "COMPLETED" ? "neutral" : "bad";

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/appointments");
  const tab = (await searchParams).tab === "history" ? "history" : "upcoming";
  const now = new Date();
  const appts = await prisma.appointment.findMany({
    where:
      tab === "upcoming"
        ? { customerId: user.id, status: { in: ["CONFIRMED", "REQUESTED", "PROPOSED"] }, endsAt: { gte: now } }
        : {
            customerId: user.id,
            OR: [{ status: { in: ["COMPLETED", "CANCELLED", "DECLINED", "NO_SHOW"] } }, { endsAt: { lt: now } }],
          },
    orderBy: { startsAt: tab === "upcoming" ? "asc" : "desc" },
    include: { business: { select: { name: true, avatarPath: true, timezone: true } }, staff: { select: { name: true } } },
    take: 100,
  });
  const needsAction = appts.filter((a) => a.status === "PROPOSED").length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))] md:px-8 md:pt-10">
      <h1 className="mb-5 text-3xl font-bold tracking-tight">התורים שלי</h1>
      <nav className="mb-6 flex gap-2" aria-label="סינון תורים">
        <Link href="/appointments" aria-current={tab === "upcoming" ? "page" : undefined} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ${tab === "upcoming" ? "bg-ink text-cream" : "border border-line bg-paper"}`}>
          קרובים {needsAction > 0 && <span className="grid size-5 place-items-center rounded-full bg-bronze-ink text-[11px] text-white">{needsAction}</span>}
        </Link>
        <Link href="/appointments?tab=history" aria-current={tab === "history" ? "page" : undefined} className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium ${tab === "history" ? "bg-ink text-cream" : "border border-line bg-paper"}`}>
          היסטוריה וביטולים
        </Link>
      </nav>
      {appts.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title={tab === "upcoming" ? "אין תורים קרובים" : "עוד אין היסטוריה"}
          text={tab === "upcoming" ? "ראית עבודה שאהבת? אפשר לקבוע תור ישר מהסרטון." : "תורים שהסתיימו או בוטלו יופיעו כאן."}
          action={<ButtonLink href="/">לגלות עבודות</ButtonLink>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {appts.map((a) => (
            <li key={a.id}>
              <Link href={`/appointments/${a.id}`} className="flex items-center gap-4 rounded-[var(--radius-card)] bg-paper p-4 shadow-[var(--shadow-soft)] transition hover:bg-sand/40">
                <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-sand py-2 text-center">
                  <span className="text-[11px] text-muted">{dt(a.startsAt, a.business.timezone).toFormat("ccc d/M")}</span>
                  <span className="ltr-nums text-sm font-bold">{formatTime(a.startsAt, a.business.timezone)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{a.serviceName}</span>
                    <Badge tone={tone(a.status)}>{STATUS_LABEL[a.status]}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
                    <Avatar src={mediaUrl(a.business.avatarPath)} name={a.business.name} size={18} />
                    {a.business.name} · {a.staff.name} · {formatDate(a.startsAt, a.business.timezone)}
                  </div>
                  <div className="ltr-nums mt-0.5 text-start text-sm font-medium">{formatPrice(a.priceAgorot, { from: !a.priceIsFinal })}</div>
                </div>
                <ChevronLeft className="size-5 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
