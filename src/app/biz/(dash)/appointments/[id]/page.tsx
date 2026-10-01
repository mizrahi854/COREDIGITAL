import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatDateTime, formatDuration, formatPrice, mediaUrl } from "@/lib/format";
import { getBizContext } from "@/server/biz-context";
import { Badge, Card } from "@/components/ui";
import { BizAppointmentActions } from "@/components/biz/appointment-actions";

export default async function BizAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBizContext();
  const { id } = await params;
  const a = await prisma.appointment.findFirst({
    where: { id, businessId: ctx.business.id, ...(ctx.role === "STAFF" ? { staffId: ctx.staffId ?? "-" } : {}) },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      staff: { select: { name: true } },
      service: { select: { name: true, priceAgorot: true, durationMin: true, active: true } },
      inspirations: { select: { reel: { select: { id: true, thumbPath: true, caption: true, business: { select: { name: true } } } } } },
      sourceReel: { select: { id: true, thumbPath: true, caption: true } },
      payments: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!a) notFound();
  const tz = ctx.business.timezone;
  const staff = await prisma.staffMember.findMany({
    where: { businessId: ctx.business.id, active: true, ...(a.serviceId ? { services: { some: { serviceId: a.serviceId } } } : {}) },
    select: { id: true, name: true },
  });
  const serviceChanged = a.service && (a.service.priceAgorot !== a.priceAgorot || a.service.durationMin !== a.durationMin);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/biz/calendar" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowRight className="size-4" aria-hidden /> ליומן
      </Link>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{a.serviceName}</h1>
            <p className="text-muted">
              {formatDateTime(a.startsAt, tz)} · {formatDuration(a.durationMin)}
              {a.bufferMin > 0 && ` + ${a.bufferMin} דק׳ הכנה`}
            </p>
          </div>
          <Badge tone={a.status === "CONFIRMED" ? "ok" : a.status === "REQUESTED" ? "warn" : a.status === "PROPOSED" ? "bronze" : a.status === "COMPLETED" ? "neutral" : "bad"}>
            {a.status === "REQUESTED" ? "בקשה — ממתינה להצעה שלך" : a.status === "PROPOSED" ? "הצעה נשלחה — ממתינה ללקוח" : STATUS_LABEL[a.status]}
          </Badge>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">לקוח/ה</dt>
            <dd className="font-semibold">{a.customer?.name ?? a.guestName ?? "—"}</dd>
            {(a.customer?.phone ?? a.guestPhone) && (
              <dd>
                <a className="ltr-nums text-bronze-ink underline-offset-4 hover:underline" href={`tel:${a.customer?.phone ?? a.guestPhone}`}>
                  {a.customer?.phone ?? a.guestPhone}
                </a>
              </dd>
            )}
            {!a.customerId && <dd className="text-xs text-muted">נקבע ידנית</dd>}
          </div>
          <div>
            <dt className="text-xs text-muted">איש צוות</dt>
            <dd className="font-semibold">{a.staff.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">מחיר שסוכם</dt>
            <dd className="ltr-nums font-semibold">{formatPrice(a.priceAgorot, { from: !a.priceIsFinal })}</dd>
            {serviceChanged && <dd className="text-xs text-muted">המחיר/משך בשירות השתנו מאז — התור שומר על מה שסוכם.</dd>}
          </div>
        </dl>
        {a.notes && (
          <div className="rounded-2xl bg-sand/60 p-3 text-sm">
            <span className="font-semibold">הערת הלקוח/ה: </span>
            {a.notes}
          </div>
        )}
        {a.payments.length > 0 && (
          <p className="text-sm text-ok">
            שולם בעסק: <span className="ltr-nums font-semibold">{formatPrice(a.payments.reduce((s, p) => s + p.amountAgorot, 0))}</span>
          </p>
        )}
      </Card>

      {(a.sourceReel || a.inspirations.length > 0) && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-bronze" aria-hidden /> השראה מהלקוח/ה
          </h2>
          {a.sourceReel && <p className="mb-3 text-sm text-muted">התור הגיע מהרילס: ״{a.sourceReel.caption}״</p>}
          <div className="flex flex-wrap gap-3">
            {a.inspirations.map((i) => (
              <a key={i.reel.id} href={`/reel/${i.reel.id}`} target="_blank" className="w-24">
                <div className="aspect-[3/4] overflow-hidden rounded-xl bg-sand">
                  {i.reel.thumbPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(i.reel.thumbPath)!} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted">{i.reel.business.name}</div>
              </a>
            ))}
          </div>
        </Card>
      )}

      <BizAppointmentActions
        appt={{
          id: a.id,
          status: a.status,
          startsAt: a.startsAt.toISOString(),
          serviceId: a.serviceId,
          staffId: a.staffId,
          durationMin: a.durationMin,
          priceAgorot: a.priceAgorot,
          isPast: a.startsAt <= new Date(),
          hasCustomer: !!a.customerId,
          businessNote: a.businessNote ?? "",
        }}
        staff={staff}
        timezone={tz}
        isOwner={ctx.role === "OWNER"}
      />

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">היסטוריה</h2>
        <ol className="flex flex-col gap-2 text-sm">
          {a.events.map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>{EVENT_LABEL[e.type] ?? e.type}</span>
              <span className="text-muted">{formatDateTime(e.createdAt, tz)}</span>
            </li>
          ))}
          <li className="text-xs text-muted">מקור: {a.source === "REEL" ? "רילס" : a.source === "MANUAL" ? "ידני" : a.source === "SEARCH" ? "חיפוש" : "פרופיל"}</li>
        </ol>
      </Card>
    </div>
  );
}
