import { Link, useNavigate, useParams } from "react-router";
import { CalendarPlus } from "lucide-react";
import { proRating } from "../domain/discover";
import { visibleTo } from "../domain/feed";
import { minToHHMM } from "../domain/time";
import { WEEKDAYS_SHORT } from "../domain/format";
import { toggleFollowPro, trackEvent } from "../store/actions";
import { gate, toast, useApp, useMe } from "../store/app";
import { Avatar, Badge, Button, EmptyState, LinkButton, SectionTitle } from "../ui/kit";
import { TopBar } from "../ui/shell";
import { PostTile } from "./discover";
import { ReviewCard, ServiceRow } from "./business";

export function ProfessionalScreen() {
  const { proId } = useParams();
  const db = useApp((s) => s.db);
  const me = useMe();
  const navigate = useNavigate();
  const p = db.professionals.find((x) => x.id === proId);
  const b = p && db.businesses.find((x) => x.id === p.businessId);
  if (!p || !b || !p.active || b.status !== "active")
    return (
      <>
        <TopBar title="פרופיל לא זמין" back />
        <div className="p-4">
          <EmptyState title="איש המקצוע לא זמין" text="ייתכן שאינו עובד יותר בעסק או שהעסק אינו פעיל." action={<LinkButton to="/discover">לגילוי</LinkButton>} />
        </div>
      </>
    );
  const r = proRating(db, p.id);
  const posts = db.posts.filter((x) => x.professionalId === p.id && visibleTo(db, x, me));
  const services = db.services.filter((s) => p.serviceIds.includes(s.id) && s.active);
  const reviews = db.reviews.filter((x) => x.professionalId === p.id && !x.hidden);
  const following = !!me?.followingPros.includes(p.id);
  const canBook = !(me?.role === "business" && me.businessId === b.id);
  const days = [...new Set(p.workingHours.map((h) => h.weekday))].sort();

  return (
    <>
      <TopBar title={p.name} sub={b.name} back />
      <div className="mx-auto max-w-3xl px-4 py-5 lg:px-6">
        <div className="flex items-center gap-4">
          <Avatar src={p.avatar} name={p.name} size={88} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black">{p.name}</h1>
            <p className="text-muted">{p.title}</p>
            <Link to={`/b/${b.id}`} className="text-sm font-semibold underline underline-offset-4">
              {b.name}
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.specialties.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
          {r.count > 0 && (
            <Badge tone="outline">
              ★ <span className="num">{r.avg.toFixed(1)}</span> · {r.count} ביקורות
            </Badge>
          )}
        </div>
        <p className="mt-3 text-sm text-muted">
          ימי עבודה: {days.map((d) => WEEKDAYS_SHORT[d]).join(" ")} · {p.workingHours[0] ? `${minToHHMM(p.workingHours[0].start)}–${minToHHMM(p.workingHours[0].end)}` : ""}
        </p>
        <div className="mt-4 flex gap-2">
          {canBook && (
            <Button className="flex-1 sm:flex-none" onClick={() => (trackEvent("booking_start", b.id), navigate(`/book/${b.id}?pro=${p.id}`))}>
              <CalendarPlus className="size-5" aria-hidden /> תור אצל {p.name.split(" ")[0]}
            </Button>
          )}
          <Button
            variant="secondary"
            aria-pressed={following}
            onClick={() => {
              if (!gate("כדי לעקוב צריך חשבון.")) return;
              const on = toggleFollowPro(p.id);
              if (on !== undefined) toast("ok", on ? `עוקב/ת אחרי ${p.name}` : "הפסקת לעקוב");
            }}
          >
            {following ? "במעקב" : "מעקב"}
          </Button>
        </div>

        <section className="mt-8">
          <SectionTitle>עבודות</SectionTitle>
          {posts.length ? (
            <ul className="grid grid-cols-3 gap-1 md:gap-2">
              {posts.map((x) => (
                <li key={x.id}>
                  <PostTile post={x} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="עוד אין עבודות מתויגות" />
          )}
        </section>
        <section className="mt-8">
          <SectionTitle>שירותים</SectionTitle>
          <ul className="flex flex-col gap-3">
            {services.map((s) => (
              <li key={s.id}>
                <ServiceRow s={s} onBook={canBook ? () => navigate(`/book/${b.id}?service=${s.id}&pro=${p.id}`) : undefined} />
              </li>
            ))}
          </ul>
        </section>
        {reviews.length > 0 && (
          <section className="mt-8">
            <SectionTitle>ביקורות</SectionTitle>
            <div className="flex flex-col gap-3">
              {reviews.map((x) => (
                <ReviewCard key={x.id} r={x} db={db} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
