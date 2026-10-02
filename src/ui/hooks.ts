import { useEffect, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router";
import { mediaStore } from "../data/repository";
import { setSettings, toast, useApp } from "../store/app";

/** Applies appearance settings to <html>: theme, glass, transparency, motion, text size, media dim. */
export function useAppearance() {
  const s = useApp((x) => x.settings);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = s.theme === "dark" || (s.theme === "system" && mq.matches);
      root.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0b0c" : "#ffffff");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [s.theme]);
  useEffect(() => {
    const root = document.documentElement;
    const g = Math.max(0, Math.min(100, s.glass)) / 100;
    // Stronger glass = more blur and slightly more see-through, never below a legible floor.
    root.style.setProperty("--glass-alpha", String(0.92 - g * 0.3));
    root.style.setProperty("--glass-blur", `${Math.round(8 + g * 22)}px`);
    root.style.setProperty("--text-scale", String(s.textScale / 100));
    root.style.setProperty("--media-brightness", String(1 - s.mediaDim / 100));
    root.dataset.transparency = s.reducedTransparency ? "reduce" : "normal";
  }, [s.glass, s.textScale, s.mediaDim, s.reducedTransparency]);
  const reduced = useReducedMotion();
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduce" : "allow";
  }, [reduced]);
}

export function useReducedMotion() {
  const pref = useApp((s) => s.settings.reducedMotion);
  const [system, setSystem] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setSystem(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return pref === "reduce" || (pref === "system" && system);
}

/** Resolves "idb:" media references to object URLs. */
export function useMediaUrl(src?: string) {
  const [url, setUrl] = useState<string | null>(() => (src && !src.startsWith("idb:") ? src : null));
  useEffect(() => {
    if (!src) return setUrl(null);
    if (!src.startsWith("idb:")) return setUrl(src);
    let alive = true;
    let created: string | null = null;
    void mediaStore.url(src).then((u) => {
      created = u;
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
      if (created?.startsWith("blob:")) URL.revokeObjectURL(created);
    };
  }, [src]);
  return url;
}

/** Remembers window scroll per route so returning from a profile or booking restores position. */
export function useScrollRestore(key?: string) {
  const loc = useLocation();
  const k = `scroll:${key ?? loc.pathname + loc.search}`;
  useLayoutEffect(() => {
    try {
      const y = Number(sessionStorage.getItem(k) ?? 0);
      if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch {
      /* ignore */
    }
    const save = () => {
      try {
        sessionStorage.setItem(k, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      window.removeEventListener("scroll", save);
    };
  }, [k]);
}

/** Location only after an explicit user action; manual city selection always works. */
export function requestGeo() {
  if (!("geolocation" in navigator)) {
    useApp.setState({ geoStatus: "unsupported" });
    toast("info", "הדפדפן לא תומך במיקום — אפשר לבחור עיר ידנית");
    return;
  }
  useApp.setState({ geoStatus: "pending" });
  navigator.geolocation.getCurrentPosition(
    (p) => {
      useApp.setState({ geo: { lat: p.coords.latitude, lng: p.coords.longitude }, geoStatus: "granted" });
      setSettings({ useGeo: true });
    },
    () => {
      useApp.setState({ geoStatus: "denied" });
      toast("info", "אין הרשאת מיקום. בחרו עיר ידנית.");
    },
    { timeout: 10000 },
  );
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
