"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Compass, Loader2, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { ReelDTO } from "@/server/feed";
import { apiFetch } from "@/lib/client";
import { Avatar, Logo, buttonClass } from "../ui";
import { CATEGORY_LABEL } from "@/lib/constants";
import { formatDuration, formatPrice } from "@/lib/format";
import { useViewer } from "../viewer";
import { ReelCard } from "./reel-card";

type Tab = "local" | "following";

export function ReelFeed({
  initial,
  initialCursor,
  tab,
  pinnedReelId,
}: {
  initial: ReelDTO[];
  initialCursor: number | null;
  tab: Tab;
  pinnedReelId?: string;
}) {
  const { viewer } = useViewer();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onMq = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onMq);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // The card most in view becomes active; only it plays.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            setActive(Number((e.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  const loadMore = useCallback(async () => {
    if (cursor == null || loadingMore) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const res = await apiFetch<{ items: ReelDTO[]; nextCursor: number | null }>(`/api/feed?tab=${tab}&cursor=${cursor}`);
      setItems((prev) => [...prev, ...res.items.filter((r) => !prev.some((p) => p.id === r.id))]);
      setCursor(res.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, tab]);

  useEffect(() => {
    if (active >= items.length - 3) void loadMore();
  }, [active, items.length, loadMore]);

  // Keyboard: arrows / j,k move between reels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[role=dialog]")) return;
      const step = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
      if (!step || !scroller.current) return;
      e.preventDefault();
      const next = Math.max(0, Math.min(items.length - 1, active + step));
      scroller.current.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, items.length, reducedMotion]);

  const updateItem = useCallback((id: string, patch: Partial<ReelDTO>) => {
    setItems((prev) =>
      prev.map((r) => {
        if (r.id === id) return { ...r, ...patch };
        // follow state is per business
        if (patch.following !== undefined && r.business.id === prev.find((x) => x.id === id)?.business.id) {
          return { ...r, following: patch.following };
        }
        return r;
      }),
    );
  }, []);

  const removeBusiness = useCallback((businessId: string) => {
    setItems((prev) => prev.filter((r) => r.business.id !== businessId));
  }, []);

  return (
    <div className="on-dark relative h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] bg-night text-cream md:h-dvh">
      {/* Top bar: logo + tabs */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b md:justify-center from-black/55 to-transparent px-4 pb-8 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-8">
        <Link href="/" className="pointer-events-auto text-lg md:hidden" aria-label="BUBER">
          <Logo dark />
        </Link>
        <nav aria-label="סוג פיד" className="pointer-events-auto flex gap-1 rounded-full bg-black/35 p-1 backdrop-blur-md">
          {(
            [
              ["local", "קרוב אליי"],
              ["following", "עוקב/ת"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={key === "local" ? "/" : "/?tab=following"}
              aria-current={tab === key ? "page" : undefined}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                tab === key ? "bg-cream text-ink" : "text-cream/80 hover:text-cream",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <span className="w-16 md:hidden" aria-hidden />
      </header>

      <div
        ref={scroller}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        aria-label="סרטונים"
      >
        {items.length === 0 && <FeedEmpty tab={tab} signedIn={!!viewer} />}
        {items.map((reel, i) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            index={i}
            isActive={i === active}
            shouldPlay={i === active && pageVisible}
            preload={Math.abs(i - active) <= 1 ? "auto" : "none"}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            reducedMotion={reducedMotion}
            onChange={updateItem}
            onHideBusiness={removeBusiness}
            pinned={reel.id === pinnedReelId}
          />
        ))}
        {items.length > 0 && (
          <div className="flex h-40 snap-end items-center justify-center text-sm text-cream/70">
            {loadingMore ? (
              <Loader2 className="size-6 animate-spin" aria-label="טוען עוד סרטונים" />
            ) : loadError ? (
              <button onClick={loadMore} className={buttonClass("light", "sm")}>
                הטעינה נכשלה — נסו שוב
              </button>
            ) : cursor == null ? (
              <div className="flex flex-col items-center gap-3">
                <span>ראית הכול כרגע ✨</span>
                <Link href="/search" className={buttonClass("light", "sm")}>
                  <Compass className="size-4" aria-hidden /> לחיפוש עסקים
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
      {items[active] && <DesktopPanel reel={items[active]} />}
    </div>
  );
}

/** Large screens: details of the active reel beside the video. */
function DesktopPanel({ reel }: { reel: ReelDTO }) {
  return (
    <aside className="pointer-events-none absolute inset-y-0 start-0 hidden w-[min(22rem,calc(50%-18.5rem))] items-center ps-6 min-[1360px]:flex" aria-label="פרטי הסרטון">
      <div className="pointer-events-auto flex w-full animate-fade flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6" key={reel.id}>
        <Link href={`/b/${reel.business.slug}`} className="flex items-center gap-3">
          <Avatar src={reel.business.avatarUrl} name={reel.business.name} size={52} />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{reel.business.name}</div>
            <div className="text-sm text-cream/65">
              {CATEGORY_LABEL[reel.category]} · {reel.business.city}
            </div>
          </div>
        </Link>
        {reel.caption && <p className="leading-relaxed text-cream/85">{reel.caption}</p>}
        {reel.service && (
          <div className="rounded-2xl bg-cream p-4 text-ink">
            <div className="text-xs text-muted">השירות בסרטון</div>
            <div className="mt-0.5 font-semibold">{reel.service.name}</div>
            <div className="text-sm text-muted">
              <span className="ltr-nums font-semibold text-ink">{formatPrice(reel.service.priceAgorot, { from: reel.service.mode === "CONSULTATION" })}</span> · {formatDuration(reel.service.durationMin)}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1 text-xs text-cream/55">
          {reel.reason && <span>למה זה מוצג לך: {reel.reason}</span>}
          <span>
            ניווט: <kbd className="rounded border border-white/20 px-1">↑</kbd> <kbd className="rounded border border-white/20 px-1">↓</kbd> · לחיצה כפולה = לייק
          </span>
        </div>
        <Link href={`/b/${reel.business.slug}`} className={buttonClass("light", "md", "w-full")}>
          לפרופיל המלא
        </Link>
      </div>
    </aside>
  );
}

function FeedEmpty({ tab, signedIn }: { tab: Tab; signedIn: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-white/10">
        <Sparkles className="size-7 text-bronze-soft" aria-hidden />
      </div>
      {tab === "following" ? (
        <>
          <h2 className="text-xl font-semibold">{signedIn ? "עוד לא עקבת אחרי עסקים" : "התחברו כדי לראות עסקים שאתם עוקבים אחריהם"}</h2>
          <p className="max-w-xs text-sm leading-relaxed text-cream/70">
            עקבו אחרי עסקים שאהבתם את העבודות שלהם — הסרטונים החדשים שלהם יופיעו כאן.
          </p>
          <Link href={signedIn ? "/" : "/login?next=/?tab=following"} className={buttonClass("light")}>
            {signedIn ? "לגלות עסקים באזור" : "התחברות"}
          </Link>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold">אין עדיין סרטונים באזור</h2>
          <p className="max-w-xs text-sm leading-relaxed text-cream/70">נסו להרחיב את החיפוש לעיר אחרת או לקטגוריה אחרת.</p>
          <Link href="/search" className={buttonClass("light")}>
            לחיפוש
          </Link>
        </>
      )}
    </div>
  );
}
