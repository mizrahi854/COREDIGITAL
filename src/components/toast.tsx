"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type Toast = { id: number; kind: "ok" | "error" | "info"; text: string; action?: { label: string; onClick: () => void } };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.action ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-cream shadow-[var(--shadow-float)]"
          >
            {t.kind === "ok" ? (
              <CheckCircle2 className="size-5 shrink-0 text-[#b9d8c2]" aria-hidden />
            ) : t.kind === "error" ? (
              <AlertCircle className="size-5 shrink-0 text-[#f0b7ab]" aria-hidden />
            ) : (
              <Info className="size-5 shrink-0 text-bronze-soft" aria-hidden />
            )}
            <span className="leading-snug">{t.text}</span>
            {t.action && (
              <button onClick={t.action.onClick} className="ms-2 shrink-0 rounded-full bg-cream/15 px-3 py-1 font-medium hover:bg-cream/25">
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
