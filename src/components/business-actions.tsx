"use client";

import { useEffect, useState } from "react";
import { Bookmark, Share2, UserPlus, UserCheck } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { useToast } from "./toast";
import { useViewer } from "./viewer";

export function BusinessActions({
  businessId,
  name,
  following: f0,
  saved: s0,
  followers,
}: {
  businessId: string;
  name: string;
  following: boolean;
  saved: boolean;
  followers: number;
}) {
  const [following, setFollowing] = useState(f0);
  const [saved, setSaved] = useState(s0);
  const [count, setCount] = useState(followers);
  const toast = useToast();
  const { requireAuth } = useViewer();

  const act = async (action: "follow" | "saveBusiness", on: boolean) => {
    if (!requireAuth(action === "follow" ? "התחברו כדי לעקוב אחרי העסק ולראות את העבודות החדשות שלו בפיד." : "התחברו כדי לשמור עסקים.")) return;
    if (action === "follow") {
      setFollowing(on);
      setCount((c) => c + (on ? 1 : -1));
    } else setSaved(on);
    try {
      await apiFetch("/api/social", { body: { action, targetId: businessId, on } });
      toast({ kind: "ok", text: action === "follow" ? (on ? `עוקב/ת אחרי ${name}` : "הפסקת לעקוב") : on ? "העסק נשמר" : "הוסר מהשמורים" });
    } catch (e) {
      if (action === "follow") {
        setFollowing(!on);
        setCount((c) => c - (on ? 1 : -1));
      } else setSaved(!on);
      toast({ kind: "error", text: (e as Error).message });
    }
  };

  const share = async () => {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ kind: "ok", text: "הקישור לפרופיל הועתק" });
      }
    } catch {}
  };

  const base = "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition active:scale-95";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => act("follow", !following)} aria-pressed={following} className={clsx(base, following ? "border-line bg-sand text-ink" : "border-ink bg-paper text-ink hover:bg-sand")}>
        {following ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
        {following ? "עוקב/ת" : "מעקב"}
        <span className="ltr-nums text-muted">{count}</span>
      </button>
      <button onClick={() => act("saveBusiness", !saved)} aria-pressed={saved} aria-label={saved ? "הסרה מהשמורים" : "שמירת העסק"} className={clsx(base, "w-11 px-0", saved ? "border-line bg-sand" : "border-line bg-paper hover:bg-sand")}>
        <Bookmark className={clsx("size-4", saved && "fill-bronze text-bronze")} />
      </button>
      <button onClick={share} aria-label="שיתוף הפרופיל" className={clsx(base, "w-11 border-line bg-paper px-0 hover:bg-sand")}>
        <Share2 className="size-4" />
      </button>
    </div>
  );
}

export function TrackEvent({ type, businessId, reelId }: { type: "PROFILE_VIEW" | "BOOKING_START"; businessId: string; reelId?: string | null }) {
  useEffect(() => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, businessId, reelId }),
    }).catch(() => {});
  }, [type, businessId, reelId]);
  return null;
}
