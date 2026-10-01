import clsx from "clsx";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "bronze" | "light";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-cream hover:bg-ink-2 shadow-sm",
  secondary: "bg-paper text-ink border border-line hover:bg-sand",
  ghost: "text-ink hover:bg-sand",
  danger: "bg-bad-soft text-bad hover:bg-[#f0d2cc]",
  bronze: "bg-bronze-ink text-white hover:bg-bronze-ink",
  light: "bg-white/90 text-ink hover:bg-white backdrop-blur",
};
const sizes = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-13 px-6 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition-[background,transform,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={clsx("rounded-[var(--radius-card)] bg-paper shadow-[var(--shadow-soft)]", className)} {...rest} />;
}

type BadgeTone = "neutral" | "bronze" | "ok" | "warn" | "bad" | "dark";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-sand text-ink-2",
  bronze: "bg-bronze-soft text-bronze-ink",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  dark: "bg-black/45 text-white backdrop-blur",
};
export function Badge({ tone = "neutral", className, ...rest }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}
      {...rest}
    />
  );
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-paper px-4 text-[16px] text-ink placeholder:text-muted/70 transition focus:border-bronze focus:outline-none focus:ring-4 focus:ring-bronze/15";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={clsx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={clsx(inputClass, "h-auto min-h-24 py-3 leading-relaxed", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={clsx(inputClass, "appearance-none bg-[length:12px] pe-4", props.className)} />;
}

export function Chip({
  active,
  className,
  ...rest
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={clsx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition active:scale-[0.97]",
        active ? "border-ink bg-ink text-cream" : "border-line bg-paper text-ink hover:bg-sand",
        className,
      )}
      {...rest}
    />
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
      {icon && <div className="grid size-14 place-items-center rounded-full bg-sand text-bronze-ink">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="max-w-sm text-sm leading-relaxed text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-sand", className)} aria-hidden />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function SampleBadge({ className, label = "תוכן לדוגמה" }: { className?: string; label?: string }) {
  return (
    <Badge tone="dark" className={clsx("border border-white/15", className)} title="נוצר להדגמה — לא עבודה אמיתית של עסק">
      {label}
    </Badge>
  );
}

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={clsx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full bg-sand-2 font-semibold text-bronze-ink", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <span className={clsx("font-black tracking-[0.18em]", dark ? "text-cream" : "text-ink", className)} dir="ltr">
      BUBER<span className="text-bronze">.</span>
    </span>
  );
}
