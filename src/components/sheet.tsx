"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

/**
 * Accessible modal: bottom sheet on mobile, centered dialog on desktop.
 * Esc closes, focus moves into the dialog and returns to the trigger on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not([data-close])");
      (el ?? ref.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("a,button,input,select,textarea,[tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center" dir="rtl">
      <button aria-label="סגירה" tabIndex={-1} data-close className="absolute inset-0 animate-fade bg-night/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={clsx(
          "relative max-h-[88dvh] w-full animate-rise overflow-y-auto rounded-t-[2rem] bg-cream p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-[var(--shadow-float)] md:max-w-lg md:rounded-[2rem]",
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-sand-2 md:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button data-close onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-sand" aria-label="סגירה">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
