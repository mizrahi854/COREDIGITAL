import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import clsx from "clsx";
import { useApp } from "../store/app";
import { Button, Field, Textarea } from "./kit";

/** Bottom sheet on phones, centered dialog on larger screens. Esc closes; focus is trapped and restored. */
export function Sheet({ open, onClose, title, children, className, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => (ref.current?.querySelector<HTMLElement>("[autofocus],input,textarea,select") ?? ref.current)?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex='-1'])")];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f.at(-1)!.focus());
        else if (!e.shiftKey && document.activeElement === f.at(-1)) (e.preventDefault(), f[0].focus());
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
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" dir="rtl">
      <div className="absolute inset-0 animate-fade bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "relative max-h-[90dvh] w-full animate-rise overflow-y-auto overscroll-contain rounded-t-[28px] bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-2xl sm:rounded-[28px]",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-surface" aria-label="סגירה">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation for changes to appointments and other consequential actions. Optional or required reason. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  danger,
  reason,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reason?: "optional" | "required";
  onConfirm: (reason: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
    }
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {body && <div className="text-[15px] leading-relaxed text-muted">{body}</div>}
        {reason && (
          <Field label={reason === "required" ? "סיבה (חובה — נשמרת ביומן הפעולות)" : "סיבה (לא חובה)"} htmlFor={id} error={error}>
            <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          </Field>
        )}
        <div className="flex gap-2">
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            onClick={() => {
              if (reason === "required" && text.trim().length < 3) return setError("נא לפרט סיבה (לפחות 3 תווים)");
              onConfirm(text.trim());
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function Toaster() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className="pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl bg-[#111] px-4 py-3 text-sm text-white shadow-xl">
          {t.kind === "ok" ? <CheckCircle2 className="size-5 shrink-0 text-[#7ee2a8]" aria-hidden /> : t.kind === "error" ? <AlertCircle className="size-5 shrink-0 text-[#ff8a8a]" aria-hidden /> : <Info className="size-5 shrink-0" aria-hidden />}
          <span className="leading-snug">{t.text}</span>
          {t.action && (
            <button type="button" onClick={t.action.run} className="ms-1 shrink-0 rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
