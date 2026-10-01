"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bookmark,
  CalendarPlus,
  Heart,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import clsx from "clsx";
import type { ReelDTO } from "@/server/feed";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatDuration, formatPrice } from "@/lib/format";
import { apiFetch } from "@/lib/client";
import { Avatar, Badge, SampleBadge } from "../ui";
import { useToast } from "../toast";
import { useViewer } from "../viewer";
import { CollectionSheet } from "./collection-sheet";
import { ReelMoreSheet } from "./reel-more-sheet";

type Props = {
  reel: ReelDTO;
  index: number;
  isActive: boolean;
  shouldPlay: boolean;
  preload: "auto" | "none";
  muted: boolean;
  onToggleMute: () => void;
  reducedMotion: boolean;
  onChange: (id: string, patch: Partial<ReelDTO>) => void;
  onHideBusiness: (businessId: string) => void;
  pinned?: boolean;
};

const viewed = new Set<string>();

export function ReelCard(p: Props) {
  const { reel } = p;
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "paused" | "error">("loading");
  const [userPaused, setUserPaused] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);
  const toast = useToast();
  const { requireAuth } = useViewer();

  // Play only the active reel; pause everything else, when hidden, or after the user paused.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const autoplay = p.shouldPlay && !userPaused && !p.reducedMotion;
    if (autoplay) {
      v.play().catch(() => setState("paused"));
    } else {
      v.pause();
      if (!p.isActive) setUserPaused(false);
    }
  }, [p.shouldPlay, p.isActive, userPaused, p.reducedMotion]);

  // Analytics: count a view after 1.5s of being the active reel.
  useEffect(() => {
    if (!p.isActive || viewed.has(reel.id)) return;
    const t = setTimeout(() => {
      viewed.add(reel.id);
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "REEL_VIEW", businessId: reel.business.id, reelId: reel.id }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [p.isActive, reel.id, reel.business.id]);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (state === "error") {
      setState("loading");
      v.load();
      return;
    }
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => setState("paused"));
    } else {
      setUserPaused(true);
      v.pause();
    }
  };

  const toggle = async (action: "like" | "save" | "follow", on: boolean) => {
    const why = {
      like: "התחברו כדי לסמן לייק ולשמור את מה שאהבתם.",
      save: "התחברו כדי לשמור השראות לאוספים שלכם.",
      follow: "התחברו כדי לעקוב אחרי עסקים ולקבל את הסרטונים שלהם בפיד.",
    }[action];
    if (!requireAuth(why)) return;
    const patch: Partial<ReelDTO> =
      action === "like"
        ? { liked: on, likeCount: reel.likeCount + (on ? 1 : -1) }
        : action === "save"
          ? { saved: on }
          : { following: on };
    p.onChange(reel.id, patch);
    if (action === "like" && on) setLikeBurst((n) => n + 1);
    try {
      const res = await apiFetch<{ likeCount?: number }>("/api/social", {
        body: { action, targetId: action === "follow" ? reel.business.id : reel.id, on },
      });
      if (res.likeCount !== undefined) p.onChange(reel.id, { likeCount: res.likeCount });
      if (action === "save" && on) {
        toast({ kind: "ok", text: "נשמר בשמורים", action: { label: "הוספה לאוסף", onClick: () => setShowCollections(true) } });
      }
      if (action === "follow") toast({ kind: "ok", text: on ? `עוקב/ת אחרי ${reel.business.name}` : "הפסקת לעקוב" });
    } catch (e) {
      p.onChange(reel.id, action === "like" ? { liked: !on, likeCount: reel.likeCount } : action === "save" ? { saved: !on } : { following: !on });
      toast({ kind: "error", text: (e as Error).message });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/reel/${reel.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: reel.business.name, text: reel.caption, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ kind: "ok", text: "הקישור הועתק" });
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const bookHref = `/b/${reel.business.slug}/book?${new URLSearchParams({
    ...(reel.service ? { service: reel.service.id } : {}),
    reel: reel.id,
    ...(reel.staff ? { staff: reel.staff.id } : {}),
  })}`;

  return (
    <section
      data-index={p.index}
      aria-label={`סרטון של ${reel.business.name}`}
      className="relative flex h-full snap-start snap-always items-center justify-center md:gap-6 md:py-6"
    >
      {/* Video frame */}
      <div className="relative h-full w-full overflow-hidden bg-night-2 md:aspect-[9/16] md:h-full md:w-auto md:rounded-[2rem] md:shadow-[var(--shadow-float)]">
        {reel.thumbUrl && (
          // Poster stays underneath so loading never shows a black box
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.thumbUrl} alt="" className="absolute inset-0 size-full object-cover" aria-hidden />
        )}
        <video
          ref={video}
          poster={reel.thumbUrl ?? undefined}
          muted={p.muted}
          playsInline
          loop
          preload={p.preload}
          onPlaying={() => setState("playing")}
          onPause={() => setState((s) => (s === "error" ? s : "paused"))}
          onWaiting={() => setState("loading")}
          onCanPlay={() => setState((s) => (s === "loading" ? (video.current?.paused ? "paused" : "playing") : s))}
          onError={() => setState("error")}
          onClick={togglePlay}
          onDoubleClick={() => !reel.liked && toggle("like", true)}
          className="absolute inset-0 size-full cursor-pointer object-cover"
          aria-label={reel.caption || "סרטון"}
        >
          {/* With <source> children, a failure fires on the last source, not on <video>. */}
          <source src={reel.videoUrl} type="video/mp4" onError={reel.webmUrl ? undefined : () => setState("error")} />
          {reel.webmUrl && <source src={reel.webmUrl} type="video/webm" onError={() => setState("error")} />}
        </video>

        {/* Center state indicator */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          {state === "loading" && p.isActive && <Loader2 className="size-10 animate-spin text-cream/80" aria-label="טוען סרטון" />}
          {state === "paused" && p.isActive && (
            <button
              onClick={togglePlay}
              className="pointer-events-auto grid size-18 place-items-center rounded-full bg-black/40 backdrop-blur-md transition hover:bg-black/55"
              aria-label="הפעלה"
            >
              <Play className="size-8 translate-x-[-2px] fill-cream text-cream" />
            </button>
          )}
          {state === "error" && (
            <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-3xl bg-black/60 px-6 py-5 text-center backdrop-blur">
              <AlertTriangle className="size-7 text-bronze-soft" aria-hidden />
              <p className="text-sm">לא הצלחנו לטעון את הסרטון</p>
              <button onClick={togglePlay} className="rounded-full bg-cream px-4 py-1.5 text-sm font-medium text-ink">
                נסו שוב
              </button>
            </div>
          )}
          {likeBurst > 0 && (
            <Heart key={likeBurst} className="size-24 animate-burst fill-[#e8b9a6] text-[#e8b9a6] drop-shadow-lg" aria-hidden />
          )}
        </div>

        {/* Top-right controls */}
        <div className="absolute end-3 top-[calc(4.25rem+env(safe-area-inset-top))] z-20 flex flex-col items-center gap-2 md:top-4">
          <button
            onClick={p.onToggleMute}
            className="grid size-11 place-items-center rounded-full bg-black/35 backdrop-blur-md transition hover:bg-black/50"
            aria-label={p.muted ? "הפעלת קול" : "השתקה"}
            aria-pressed={!p.muted}
          >
            {p.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          {state === "playing" && (
            <button onClick={togglePlay} className="grid size-11 place-items-center rounded-full bg-black/35 backdrop-blur-md" aria-label="השהיה">
              <Pause className="size-5" />
            </button>
          )}
        </div>
        <div className="absolute start-3 top-[calc(4.25rem+env(safe-area-inset-top))] z-20 flex flex-col items-start gap-1.5 md:top-4">
          {reel.isSample && <SampleBadge />}
          {p.pinned && <Badge tone="dark">סרטון ששותף איתך</Badge>}
        </div>

        {/* Bottom gradient + info */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-4 pe-[4.75rem] md:pe-4">
          <div className="flex items-center gap-2.5">
            <Link href={`/b/${reel.business.slug}`} className="flex min-w-0 items-center gap-2.5">
              <Avatar src={reel.business.avatarUrl} name={reel.business.name} size={40} className="ring-2 ring-white/70" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-shadow">{reel.business.name}</span>
                  {reel.business.verified && <Badge tone="bronze">מאומת</Badge>}
                </div>
                <div className="truncate text-xs text-cream/80">
                  {CATEGORY_LABEL[reel.category]} · {reel.business.city}
                  {reel.business.isDemo && " · עסק לדוגמה"}
                </div>
              </div>
            </Link>
            <button
              onClick={() => toggle("follow", !reel.following)}
              className={clsx(
                "ms-1 h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition active:scale-95",
                reel.following ? "border border-white/40 text-cream" : "bg-cream text-ink",
              )}
              aria-pressed={reel.following}
            >
              {reel.following ? "עוקב/ת" : "מעקב"}
            </button>
          </div>
          {reel.caption && <p className="line-clamp-2 text-[15px] leading-snug text-shadow">{reel.caption}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            {reel.tags.slice(0, 3).map((t) => (
              <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="rounded-full bg-white/12 px-2.5 py-0.5 text-xs text-cream/90 backdrop-blur hover:bg-white/20">
                #{t}
              </Link>
            ))}
            {reel.reason && (
              <span className="text-[11px] text-cream/65" title="איך נבחר הסדר: עסקים שאת/ה עוקב/ת, האזור שלך, תחומי העניין וחדשות">
                · {reel.reason}
              </span>
            )}
          </div>

          {/* Booking card */}
          <div className="flex items-center gap-3 rounded-[1.4rem] bg-cream/95 p-2.5 ps-4 text-ink shadow-[var(--shadow-float)] backdrop-blur">
            <div className="min-w-0 flex-1">
              {reel.service ? (
                <>
                  <div className="truncate text-sm font-semibold">{reel.service.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="ltr-nums font-semibold text-ink">
                      {formatPrice(reel.service.priceAgorot, { from: reel.service.mode === "CONSULTATION" })}
                    </span>
                    <span>· {formatDuration(reel.service.durationMin)}</span>
                    {reel.service.mode === "CONSULTATION" && <span>· בתיאום מחיר</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="truncate text-sm font-semibold">רוצה את זה?</div>
                  <div className="text-xs text-muted">בחרו שירות ומועד אצל {reel.business.name}</div>
                </>
              )}
            </div>
            <Link
              href={bookHref}
              onClick={() =>
                void fetch("/api/events", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "BOOKING_START", businessId: reel.business.id, reelId: reel.id }),
                }).catch(() => {})
              }
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-cream transition hover:bg-ink-2 active:scale-95"
            >
              <CalendarPlus className="size-4" aria-hidden />
              קביעת תור
            </Link>
          </div>
        </div>

        {/* Action rail (mobile: over video) */}
        <ActionRail className="absolute bottom-[8.75rem] end-2.5 z-20 md:hidden" reel={reel} onLike={() => toggle("like", !reel.liked)} onSave={() => toggle("save", !reel.saved)} onShare={share} onMore={() => setShowMore(true)} />
      </div>

      {/* Action rail (desktop: beside video) */}
      <ActionRail className="hidden self-end pb-40 md:flex" reel={reel} onLike={() => toggle("like", !reel.liked)} onSave={() => toggle("save", !reel.saved)} onShare={share} onMore={() => setShowMore(true)} />

      <CollectionSheet open={showCollections} onClose={() => setShowCollections(false)} reelId={reel.id} />
      <ReelMoreSheet
        open={showMore}
        onClose={() => setShowMore(false)}
        reel={reel}
        onHidden={() => p.onHideBusiness(reel.business.id)}
        onAddToCollection={() => {
          setShowMore(false);
          if (requireAuth("התחברו כדי לארגן השראות באוספים.")) setShowCollections(true);
        }}
      />
    </section>
  );
}

function ActionRail({
  reel,
  onLike,
  onSave,
  onShare,
  onMore,
  className,
}: {
  reel: ReelDTO;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onMore: () => void;
  className?: string;
}) {
  const btn = "grid size-12 place-items-center rounded-full bg-black/30 backdrop-blur-md transition hover:bg-black/45 active:scale-90 md:bg-white/8 md:hover:bg-white/15";
  return (
    <div className={clsx("flex flex-col items-center gap-3", className)}>
      <div className="flex flex-col items-center gap-1">
        <button onClick={onLike} className={btn} aria-pressed={reel.liked} aria-label={reel.liked ? "ביטול לייק" : "לייק"}>
          <Heart className={clsx("size-6 transition", reel.liked && "animate-pop fill-[#e8a796] text-[#e8a796]")} />
        </button>
        <span className="ltr-nums text-xs font-medium text-cream/90">{reel.likeCount}</span>
      </div>
      <button onClick={onSave} className={btn} aria-pressed={reel.saved} aria-label={reel.saved ? "הסרה מהשמורים" : "שמירה"}>
        <Bookmark className={clsx("size-6", reel.saved && "animate-pop fill-bronze-soft text-bronze-soft")} />
      </button>
      <button onClick={onShare} className={btn} aria-label="שיתוף">
        <Send className="size-6 -scale-x-100" />
      </button>
      <button onClick={onMore} className={btn} aria-label="אפשרויות נוספות">
        <MoreHorizontal className="size-6" />
      </button>
    </div>
  );
}
