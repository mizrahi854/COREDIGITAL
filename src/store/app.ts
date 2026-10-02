import { create } from "zustand";
import type { DB, ID, NotificationCategory, User } from "../domain/types";
import { repository } from "../data/repository";
import { expireHolds } from "../domain/booking";
import { EMPTY_FILTERS, type DiscoverFilters } from "../domain/discover";
import type { FeedTab } from "../domain/feed";

export interface Settings {
  theme: "light" | "dark" | "system";
  /** 0–100: strength of the frosted glass. */
  glass: number;
  reducedTransparency: boolean;
  reducedMotion: "system" | "reduce" | "allow";
  captions: boolean;
  autoplay: boolean;
  dataSaver: boolean;
  textScale: 100 | 112 | 125;
  /** Dims photos and videos inside the app only — not the device screen. */
  mediaDim: number;
  notify: Record<NotificationCategory, boolean>;
  cityId: ID | null;
  useGeo: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  glass: 70,
  reducedTransparency: false,
  reducedMotion: "system",
  captions: true,
  autoplay: true,
  dataSaver: false,
  textScale: 100,
  mediaDim: 0,
  notify: { appointments: true, messages: true, social: true, business: true },
  cityId: "tlv",
  useGeo: false,
};

export interface BookingDraft {
  businessId: ID;
  serviceId?: ID;
  professionalId?: ID | null;
  date?: string;
  start?: string;
  note: string;
  inspirationPostIds: ID[];
  sourcePostId?: ID;
  /** Discovery/feed context to return to after booking. */
  returnTo?: string;
  step?: number;
}

export interface Toast {
  id: number;
  kind: "ok" | "error" | "info";
  text: string;
  action?: { label: string; run: () => void };
}

interface State {
  db: DB;
  userId: ID | null;
  viewMode: "business" | "customer";
  settings: Settings;
  geo: { lat: number; lng: number } | null;
  geoStatus: "idle" | "pending" | "granted" | "denied" | "unsupported";
  discover: DiscoverFilters & { view: "grid" | "list" | "map"; mode: "businesses" | "posts" };
  feedTab: FeedTab;
  feedIndex: Record<FeedTab, number>;
  bookingDraft: BookingDraft | null;
  toasts: Toast[];
  welcomed: boolean;
  /** Reason shown when a guest tries an action that needs an account. */
  authPrompt: { reason: string; next?: string } | null;
}

const SESSION_KEY = "beautigo.session";
const SETTINGS_KEY = "beautigo.settings";
const UI_KEY = "beautigo.ui";

function read<T>(key: string, fallback: T, storage: "local" | "session" = "local"): T {
  try {
    const raw = (storage === "local" ? localStorage : sessionStorage).getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown, storage: "local" | "session" = "local") {
  try {
    (storage === "local" ? localStorage : sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — state lives in memory for this session */
  }
}

const initialDb = repository.load();
if (expireHolds(initialDb)) repository.save(initialDb);
const session = read(SESSION_KEY, { userId: null as ID | null, viewMode: "business" as State["viewMode"], welcomed: false });
const ui = read(UI_KEY, { discover: { ...EMPTY_FILTERS, view: "grid" as const, mode: "businesses" as const }, feedTab: "for_you" as FeedTab, bookingDraft: null as BookingDraft | null }, "session");

export const useApp = create<State>(() => ({
  db: initialDb,
  userId: session.userId,
  viewMode: session.viewMode,
  welcomed: session.welcomed,
  settings: read(SETTINGS_KEY, DEFAULT_SETTINGS),
  geo: null,
  geoStatus: "idle",
  discover: ui.discover,
  feedTab: ui.feedTab,
  feedIndex: { for_you: 0, following: 0, nearby: 0 },
  bookingDraft: ui.bookingDraft,
  toasts: [],
  authPrompt: null,
}));

// Persist slices whenever they change
useApp.subscribe((s, prev) => {
  if (s.db !== prev.db) repository.save(s.db);
  if (s.userId !== prev.userId || s.viewMode !== prev.viewMode || s.welcomed !== prev.welcomed)
    write(SESSION_KEY, { userId: s.userId, viewMode: s.viewMode, welcomed: s.welcomed });
  if (s.settings !== prev.settings) write(SETTINGS_KEY, s.settings);
  if (s.discover !== prev.discover || s.feedTab !== prev.feedTab || s.bookingDraft !== prev.bookingDraft)
    write(UI_KEY, { discover: s.discover, feedTab: s.feedTab, bookingDraft: s.bookingDraft }, "session");
});

// Keep the database in sync across tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "beautigo.db" && e.newValue) {
      try {
        useApp.setState({ db: JSON.parse(e.newValue) });
      } catch {
        /* ignore malformed */
      }
    }
  });
  // Release expired holds periodically
  setInterval(() => {
    const db = structuredClone(useApp.getState().db);
    if (expireHolds(db)) useApp.setState({ db });
  }, 30_000);
}

export const me = (s: State = useApp.getState()): User | null => s.db.users.find((u) => u.id === s.userId) ?? null;

export function useMe() {
  return useApp((s) => s.db.users.find((u) => u.id === s.userId) ?? null);
}

/** Business owners can switch to the customer experience; everyone else has one mode. */
export function useMode(): "guest" | "customer" | "business" | "staff" | "admin" {
  const user = useMe();
  const viewMode = useApp((s) => s.viewMode);
  if (!user) return "guest";
  if (user.role === "business") return viewMode === "customer" ? "customer" : "business";
  return user.role;
}

let toastId = 0;
export function toast(kind: Toast["kind"], text: string, action?: Toast["action"]) {
  const id = ++toastId;
  useApp.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, text, action }] }));
  setTimeout(() => useApp.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), action ? 6000 : 3800);
}

/**
 * Runs a mutation on a copy of the database and commits it atomically.
 * If the function throws (permission or validation error), nothing is saved,
 * the error message is shown and `undefined` is returned.
 */
export function mutate<T>(fn: (db: DB, user: User | null) => T, opts: { silent?: boolean } = {}): (T extends void ? true : T) | undefined {
  const state = useApp.getState();
  const draft = structuredClone(state.db);
  try {
    const result = fn(draft, draft.users.find((u) => u.id === state.userId) ?? null);
    useApp.setState({ db: draft });
    // `undefined` always means failure; actions without a result report `true`.
    return (result === undefined ? true : result) as T extends void ? true : T;
  } catch (e) {
    if (!opts.silent) toast("error", (e as Error).message || "משהו השתבש");
    return undefined;
  }
}

export function setSettings(patch: Partial<Settings>) {
  useApp.setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

/** Returns true when signed in; otherwise opens the sign-in prompt and returns false. */
export function gate(reason: string, next?: string) {
  if (useApp.getState().userId) return true;
  useApp.setState({ authPrompt: { reason, next } });
  return false;
}
