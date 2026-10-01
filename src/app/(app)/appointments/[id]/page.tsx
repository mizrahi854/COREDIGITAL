import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, BellRing, CheckCircle2, Clock, Hourglass, MapPin, Phone, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatDateTime, formatDuration, formatPrice, mediaUrl } from "@/lib/format";
import { getUser } from "@/server/auth";
import { getCustomerAppointment } from "@/server/appointments";
import { publicReelWhere } from "@/server/feed";
import { withinCancellationWindow } from "@/server/booking";
import { Avatar, Badge, Card } from "@/components/ui";
import { AppointmentActions } from "@/components/booking/appointment-actions";

export const metadata: Metadata = { title: "פרטי התור" };


export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await getUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/appointments/${id}`);
  const a = await getCustomerAppointment(id, user.id);
  if (!a) notFound();
  const isNew = (await searchParams).new === "1";
  const tz = a.business.timezone;

  const [notifications, saved] = await Promise.all([
    prisma.notification.findMany({ where: { appointmentId: a.id, userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.savedReel.findMany({
      where: { userId: user.id, reel: publicReelWhere },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { reel: { select: { id: true, thumbPath: true, caption: true } } },
    }),
  ]);
  const proposedStaff = a.proposedStaffId ? await prisma.staffMember.findUnique({ where: { id: a.proposedStaffId }, select: { name: true } }) : null;

  const active = ["CONFIRMED", "REQUESTED", "PROPOSED"].includes(a.status) && a.endsAt > new Date();
  const canChange = a.status === "CONFIRMED" && withinCancellationWindow(a);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8 md:pt-10">
      <Link href="/appointments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowRight className="size-4" aria-hidden /> לכל התורים
      </Link>

      {isNew && a.status === "CONFIRMED" && (
        <div className="mb-6 flex animate-rise flex-col items-center gap-3 rounded-[2rem] bg-ink p-8 text-center text-cream" role="status">
          <span className="grid size-16 place-items-center rounded-full bg-cream/10">
            <CheckCircle2 className="size-9 text-[#b9d8c2]" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold">התור נקבע ומאושר</h1>
          <p className="text-cream/75">
            {a.serviceName} ב{a.business.name} · {formatDateTime(a.startsAt, tz)}
          </p>
        </div>
      )}
      {isNew && a.status === "REQUESTED" && (
        <div className="mb-6 flex animate-rise flex-col items-center gap-3 rounded-[2rem] bg-warn-soft p-8 text-center text-warn" role="status">
          <span className="grid size-16 place-items-center rounded-full bg-white/60">
            <Hourglass className="size-8" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-ink">הבקשה נשלחה — התור עוד לא מאושר</h1>
          <p className="text-ink-2">{a.business.name} יבדקו את הבקשה ויחזרו עם מחיר ומועד סופיים. נעדכן כאן כשתגיע הצעה.</p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line p-5">
          <Avatar src={mediaUrl(a.business.avatarPath)} name={a.business.name} size={48} />
          <div className="min-w-0 flex-1">
            <Link href={`/b/${a.business.slug}`} className="font-semibold hover:underline">
              {a.business.name}
            </Link>
            <div className="text-sm text-muted">{a.business.isDemo ? "עסק לדוגמה" : ""}</div>
          </div>
          <Badge tone={a.status === "CONFIRMED" ? "ok" : a.status === "PROPOSED" ? "warn" : a.status === "REQUESTED" ? "bronze" : a.status === "COMPLETED" ? "neutral" : "bad"}>
            {STATUS_LABEL[a.status]}
          </Badge>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{a.serviceName}</h2>
              <p className="text-sm text-muted">עם {a.staff.name}</p>
            </div>
            <div className="text-end">
              <div className="ltr-nums text-xl font-bold">{formatPrice(a.priceAgorot, { from: !a.priceIsFinal })}</div>
              {!a.priceIsFinal && <div className="text-xs text-warn">מחיר משוער — טרם סוכם</div>}
            </div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex gap-2.5">
              <Clock className="mt-0.5 size-4 text-bronze-ink" aria-hidden />
              <div>
                <dt className="text-xs text-muted">{a.status === "REQUESTED" ? "מועד מועדף (לא שמור)" : "מועד"}</dt>
                <dd className="font-medium">
                  {formatDateTime(a.startsAt, tz)} · {formatDuration(a.durationMin)}
                </dd>
              </div>
            </div>
            <div className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 text-bronze-ink" aria-hidden />
              <div>
                <dt className="text-xs text-muted">כתובת</dt>
                <dd className="font-medium">{[a.business.address, a.business.city].filter(Boolean).join(", ")}</dd>
              </div>
            </div>
            <div className="flex gap-2.5">
              <Wallet className="mt-0.5 size-4 text-bronze-ink" aria-hidden />
              <div>
                <dt className="text-xs text-muted">תשלום</dt>
                <dd className="font-medium">בעסק, במועד הטיפול</dd>
              </div>
            </div>
            {a.business.phone && (
              <div className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 text-bronze-ink" aria-hidden />
                <div>
                  <dt className="text-xs text-muted">טלפון העסק</dt>
                  <dd>
                    <a href={`tel:${a.business.phone}`} className="ltr-nums font-medium underline-offset-4 hover:underline">
                      {a.business.phone}
                    </a>
                  </dd>
                </div>
              </div>
            )}
          </dl>
          {a.notes && (
            <div className="rounded-2xl bg-sand/50 p-3 text-sm">
              <span className="font-semibold">ההערות שלך: </span>
              {a.notes}
            </div>
          )}
          <div className="rounded-2xl border border-line p-3 text-sm">
            <span className="font-semibold">מדיניות ביטול (כפי שסוכמה בעת ההזמנה): </span>
            <span className="text-ink-2">{a.cancellationPolicy}</span>
          </div>
          {a.cancelReason && (a.status === "CANCELLED" || a.status === "DECLINED") && (
            <p className="text-sm text-bad">סיבה: {a.cancelReason}</p>
          )}
        </div>
      </Card>

      <AppointmentActions
        appointment={{
          id: a.id,
          status: a.status,
          startsAt: a.startsAt.toISOString(),
          businessId: a.businessId,
          serviceId: a.serviceId,
          staffId: a.staffId,
          timezone: tz,
          cancellationHours: a.cancellationHours,
          canChange,
          active,
          hasReview: !!a.review,
          proposal:
            a.status === "PROPOSED" && a.proposedStartsAt
              ? {
                  startsAt: a.proposedStartsAt.toISOString(),
                  priceAgorot: a.proposedPriceAgorot ?? a.priceAgorot,
                  durationMin: a.proposedDurationMin ?? a.durationMin,
                  staffName: proposedStaff?.name ?? "",
                  note: a.proposalNote,
                }
              : null,
        }}
        inspirations={a.inspirations.map((i) => ({ id: i.reel.id, thumbUrl: mediaUrl(i.reel.thumbPath), caption: i.reel.caption }))}
        savedReels={saved.map((s) => ({ id: s.reel.id, thumbUrl: mediaUrl(s.reel.thumbPath), caption: s.reel.caption }))}
      />

      {a.review && (
        <Card className="mt-4 p-5 text-sm">
          <div className="font-semibold">הביקורת שלך: {"★".repeat(a.review.rating)}</div>
          {a.review.text && <p className="mt-1 text-ink-2">{a.review.text}</p>}
        </Card>
      )}

      {notifications.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <BellRing className="size-4 text-bronze-ink" aria-hidden /> הודעות על התור
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper px-4 py-3">
                <span>{n.subject}</span>
                <span className="text-xs text-muted">
                  {n.status === "LOGGED"
                    ? "מצב פיתוח: נרשם ביומן — לא נשלח בפועל"
                    : n.status === "SENT"
                      ? "נשלח"
                      : n.status === "PENDING"
                        ? `מתוזמן ל־${formatDateTime(n.scheduledFor, tz)}`
                        : n.status === "CANCELLED"
                          ? "בוטל"
                          : "השליחה נכשלה"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">היסטוריית התור</h2>
        <ol className="relative flex flex-col gap-4 border-s-2 border-line ps-5 text-sm">
          {a.events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -start-[27px] top-1 size-3 rounded-full border-2 border-cream bg-bronze" aria-hidden />
              <div className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</div>
              <div className="text-xs text-muted">{formatDateTime(e.createdAt, tz)}</div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
