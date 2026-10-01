import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarPlus, Clock, MapPin, Phone, Play, ShieldCheck, Star } from "lucide-react";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { BUSINESS_TZ, CATEGORY_LABEL, WEEKDAYS_HE } from "@/lib/constants";
import { formatDuration, formatPrice, mediaUrl, minutesToHHMM, relativeTime } from "@/lib/format";
import { getUser } from "@/server/auth";
import { publicReelWhere } from "@/server/feed";
import { Avatar, Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { BusinessActions, TrackEvent } from "@/components/business-actions";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return prisma.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      staff: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: { services: { select: { serviceId: true } } } },
      openingHours: { orderBy: [{ weekday: "asc" }, { openMin: "asc" }] },
      reels: { where: publicReelWhere, orderBy: { publishedAt: "desc" }, select: { id: true, thumbPath: true, caption: true, isSample: true } },
      portfolio: { orderBy: { createdAt: "desc" }, take: 12 },
      reviews: { orderBy: { createdAt: "desc" }, take: 20, include: { customer: { select: { name: true } }, appointment: { select: { serviceName: true } } } },
      _count: { select: { followers: true, reviews: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await prisma.business.findUnique({ where: { slug }, select: { name: true, tagline: true, city: true } });
  return b ? { title: b.name, description: `${b.tagline ?? ""} · ${b.city}` } : {};
}

export default async function BusinessPage({ params }: Props) {
  const { slug } = await params;
  const [b, user] = await Promise.all([load(slug), getUser()]);
  if (!b) notFound();
  const isMember = user ? await prisma.businessMember.count({ where: { businessId: b.id, userId: user.id } }) : 0;
  if (b.status !== "APPROVED" && !isMember && !user?.isAdmin) notFound();

  const [follow, saved] = user
    ? await Promise.all([
        prisma.follow.count({ where: { userId: user.id, businessId: b.id } }),
        prisma.savedBusiness.count({ where: { userId: user.id, businessId: b.id } }),
      ])
    : [0, 0];
  const avg = b.reviews.length ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length : null;
  const allSample = b.reviews.length > 0 && b.reviews.every((r) => r.isSample);
  const today = DateTime.now().setZone(BUSINESS_TZ).weekday % 7;
  const minPrice = b.services.length ? Math.min(...b.services.map((s) => s.priceAgorot)) : null;

  return (
    <main className="pb-28 md:pb-12">
      <TrackEvent type="PROFILE_VIEW" businessId={b.id} />
      {b.status !== "APPROVED" && (
        <div className="bg-warn-soft px-4 py-2 text-center text-sm text-warn">העסק ממתין לאישור צוות BUBER ועדיין לא מוצג ללקוחות.</div>
      )}
      {/* Cover */}
      <div className="relative h-56 overflow-hidden bg-sand md:mx-6 md:mt-6 md:h-80 md:rounded-[2rem]">
        {b.coverPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(b.coverPath)!} alt="" className="size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />
        <Link href="/" className="absolute start-4 top-[calc(1rem+env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-cream/90 text-ink backdrop-blur md:hidden" aria-label="חזרה">
          <ArrowRight className="size-5" />
        </Link>
        {b.isDemo && <Badge tone="dark" className="absolute end-4 top-[calc(1rem+env(safe-area-inset-top))]">עסק לדוגמה · לא עסק אמיתי</Badge>}
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-8 md:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {/* Header */}
            <div className="-mt-12 flex flex-col gap-4">
              <Avatar src={mediaUrl(b.avatarPath)} name={b.name} size={96} className="relative ring-4 ring-cream" />
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">{b.name}</h1>
                  {b.verified && (
                    <Badge tone="bronze">
                      <ShieldCheck className="size-3.5" aria-hidden /> מאומת ע״י BUBER
                    </Badge>
                  )}
                </div>
                {b.tagline && <p className="text-[17px] text-ink-2">{b.tagline}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span>{b.categories.map((c) => CATEGORY_LABEL[c]).join(" · ")}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden /> {b.city}
                  </span>
                  {avg !== null && (
                    <a href="#reviews" className="flex items-center gap-1 text-ink">
                      <Star className="size-4 fill-bronze text-bronze" aria-hidden />
                      <span className="ltr-nums font-semibold">{avg.toFixed(1)}</span>
                      <span className="text-muted">({b._count.reviews} ביקורות{allSample ? " לדוגמה" : ""})</span>
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ButtonLink href={`/b/${b.slug}/book`} size="md" className="md:hidden">
                  <CalendarPlus className="size-4" aria-hidden /> קביעת תור
                </ButtonLink>
                <BusinessActions businessId={b.id} name={b.name} following={!!follow} saved={!!saved} followers={b._count.followers} />
              </div>
            </div>

            {/* Section nav */}
            <nav aria-label="חלקי העמוד" className="no-scrollbar sticky top-0 z-20 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-cream/90 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
              {[
                ["#work", "עבודות"],
                ["#services", "שירותים ומחירים"],
                ["#team", "צוות"],
                ...(b.reviews.length ? [["#reviews", "ביקורות"]] : []),
                ["#info", "מידע ושעות"],
              ].map(([href, label]) => (
                <a key={href} href={href} className="inline-flex h-9 shrink-0 items-center rounded-full border border-line bg-paper px-4 text-sm font-medium hover:bg-sand">
                  {label}
                </a>
              ))}
            </nav>

            {/* Work */}
            <section id="work" className="scroll-mt-16 pt-4">
              <h2 className="mb-3 text-xl font-semibold">עבודות ורילס</h2>
              {b.reels.length === 0 && b.portfolio.length === 0 ? (
                <EmptyState title="עוד אין עבודות" text="העסק עדיין לא העלה סרטונים או תמונות." />
              ) : (
                <div className="grid grid-cols-3 gap-1.5 md:gap-3">
                  {b.reels.map((r) => (
                    <Link key={r.id} href={`/reel/${r.id}`} className="group relative aspect-[9/16] overflow-hidden rounded-2xl bg-sand" aria-label={r.caption || "סרטון"}>
                      {r.thumbPath && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(r.thumbPath)!} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                      )}
                      <span className="absolute start-2 top-2 grid size-7 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
                        <Play className="size-3.5 fill-white" aria-hidden />
                      </span>
                      {r.isSample && <span className="absolute inset-x-2 bottom-2 truncate rounded-full bg-black/45 px-2 py-0.5 text-center text-[10px] text-white">לדוגמה</span>}
                    </Link>
                  ))}
                  {b.portfolio.map((p) => (
                    <div key={p.id} className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-sand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(p.imagePath)!} alt={p.caption || "עבודה מהתיק"} loading="lazy" className="size-full object-cover" />
                      {p.isSample && <span className="absolute inset-x-2 bottom-2 truncate rounded-full bg-black/45 px-2 py-0.5 text-center text-[10px] text-white">לדוגמה</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Services */}
            <section id="services" className="scroll-mt-16 pt-10">
              <h2 className="mb-3 text-xl font-semibold">שירותים ומחירים</h2>
              {b.services.length === 0 ? (
                <EmptyState title="אין שירותים זמינים כרגע" />
              ) : (
                <ul className="flex flex-col gap-3">
                  {b.services.map((s) => (
                    <li key={s.id}>
                      <Card className="flex items-center gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{s.name}</h3>
                            {s.mode === "CONSULTATION" && <Badge tone="warn">מחיר סופי בתיאום</Badge>}
                          </div>
                          {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p>}
                          <div className="mt-2 flex items-center gap-3 text-sm">
                            <span className="ltr-nums font-semibold">{formatPrice(s.priceAgorot, { from: s.mode === "CONSULTATION" })}</span>
                            <span className="flex items-center gap-1 text-muted">
                              <Clock className="size-3.5" aria-hidden /> {formatDuration(s.durationMin)}
                            </span>
                          </div>
                        </div>
                        <ButtonLink href={`/b/${b.slug}/book?service=${s.id}`} variant="secondary" size="sm" className="shrink-0">
                          {s.mode === "CONSULTATION" ? "בקשת הצעה" : "קביעה"}
                        </ButtonLink>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Team */}
            <section id="team" className="scroll-mt-16 pt-10">
              <h2 className="mb-3 text-xl font-semibold">הצוות</h2>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
                {b.staff.map((s) => (
                  <Card key={s.id} className="flex w-40 shrink-0 flex-col items-center gap-2 p-4 text-center">
                    <Avatar src={mediaUrl(s.avatarPath)} name={s.name} size={64} />
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted">{s.title}</div>
                    <Link href={`/b/${b.slug}/book?staff=${s.id}`} className="text-xs font-medium text-bronze-ink underline-offset-4 hover:underline">
                      קביעה אצל {s.name.split(" ")[0]}
                    </Link>
                  </Card>
                ))}
              </div>
            </section>

            {/* Reviews */}
            {b.reviews.length > 0 && (
              <section id="reviews" className="scroll-mt-16 pt-10">
                <h2 className="mb-1 text-xl font-semibold">ביקורות</h2>
                <p className="mb-3 text-sm text-muted">רק לקוחות שסיימו טיפול שנקבע דרך BUBER יכולים לכתוב ביקורת.</p>
                <ul className="flex flex-col gap-3">
                  {b.reviews.map((r) => (
                    <li key={r.id}>
                      <Card className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={r.customer.name} size={32} />
                            <span className="font-medium">{r.customer.name.split(" ")[0]}</span>
                            {r.isSample && <Badge>ביקורת לדוגמה</Badge>}
                          </div>
                          <span className="flex items-center gap-0.5" aria-label={`${r.rating} מתוך 5`}>
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} className={i < r.rating ? "size-4 fill-bronze text-bronze" : "size-4 text-line"} aria-hidden />
                            ))}
                          </span>
                        </div>
                        {r.text && <p className="mt-2 text-[15px] leading-relaxed">{r.text}</p>}
                        <p className="mt-2 text-xs text-muted">
                          {r.appointment.serviceName} · {relativeTime(r.createdAt)}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Info */}
            <section id="info" className="scroll-mt-16 pt-10">
              <h2 className="mb-3 text-xl font-semibold">מידע ושעות פתיחה</h2>
              <Card className="flex flex-col gap-5 p-5">
                {b.description && <p className="leading-relaxed text-ink-2">{b.description}</p>}
                <div className="flex flex-col gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4 text-bronze-ink" aria-hidden /> {[b.address, b.city].filter(Boolean).join(", ")}
                  </span>
                  {b.phone && (
                    <a href={`tel:${b.phone}`} className="flex items-center gap-2">
                      <Phone className="size-4 text-bronze-ink" aria-hidden /> <span className="ltr-nums">{b.phone}</span>
                    </a>
                  )}
                </div>
                <table className="w-full text-sm">
                  <caption className="sr-only">שעות פתיחה</caption>
                  <tbody>
                    {WEEKDAYS_HE.map((d, i) => {
                      const hours = b.openingHours.filter((h) => h.weekday === i);
                      return (
                        <tr key={d} className={i === today ? "font-semibold" : "text-ink-2"}>
                          <th scope="row" className="py-1.5 text-start font-[inherit]">
                            {d} {i === today && <span className="text-xs font-normal text-bronze-ink">(היום)</span>}
                          </th>
                          <td className="ltr-nums py-1.5 text-end">
                            {hours.length ? hours.map((h) => `${minutesToHHMM(h.openMin)}–${minutesToHHMM(h.closeMin)}`).join(", ") : <span className="text-muted">סגור</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="rounded-2xl bg-sand/60 p-4 text-sm">
                  <div className="mb-1 font-semibold">מדיניות ביטול</div>
                  <p className="text-ink-2">{b.cancellationPolicy}</p>
                  <p className="mt-1 text-xs text-muted">תשלום בעסק במועד הטיפול.</p>
                </div>
              </Card>
            </section>
          </div>

          {/* Desktop booking card */}
          <aside className="hidden md:block">
            <Card className="sticky top-6 mt-6 flex flex-col gap-4 p-5">
              <div>
                <div className="text-sm text-muted">החל מ־</div>
                <div className="ltr-nums text-start text-3xl font-bold">{minPrice != null ? formatPrice(minPrice) : "—"}</div>
              </div>
              <ul className="flex flex-col divide-y divide-line text-sm">
                {b.services.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link href={`/b/${b.slug}/book?service=${s.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:text-bronze-ink">
                      <span className="truncate">{s.name}</span>
                      <span className="ltr-nums shrink-0 text-muted">{formatPrice(s.priceAgorot, { from: s.mode === "CONSULTATION" })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <ButtonLink href={`/b/${b.slug}/book`} size="lg" className="w-full">
                <CalendarPlus className="size-5" aria-hidden /> קביעת תור
              </ButtonLink>
              <p className="text-center text-xs text-muted">{b.cancellationHours > 0 ? `ביטול חינם עד ${b.cancellationHours} שעות לפני` : "ראו מדיניות ביטול"}</p>
            </Card>
          </aside>
        </div>
      </div>

      {/* Mobile sticky booking bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{b.name}</div>
            {minPrice != null && <div className="text-xs text-muted">החל מ־<span className="ltr-nums">{formatPrice(minPrice)}</span></div>}
          </div>
          <ButtonLink href={`/b/${b.slug}/book`} className="shrink-0">
            <CalendarPlus className="size-4" aria-hidden /> קביעת תור
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
