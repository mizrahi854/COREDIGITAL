import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { useApp, useMe } from "../../store/app";
import type { Appointment, DB, User } from "../../domain/types";

/** Business context for owner or staff. Staff see only their own professional column. */
export function useBiz() {
  const db = useApp((s) => s.db);
  const me = useMe()!;
  const business = db.businesses.find((b) => b.id === me.businessId)!;
  const isStaff = me.role === "staff";
  const pros = db.professionals.filter((p) => p.businessId === business.id && (!isStaff || p.id === me.professionalId));
  const appointments = db.appointments.filter((a) => a.businessId === business.id && (!isStaff || a.professionalId === me.professionalId));
  return { db, me, business, isStaff, pros, appointments };
}

export function customerName(db: DB, a: Appointment) {
  if (a.customerId) return db.users.find((u) => u.id === a.customerId)?.name ?? "לקוח/ה";
  return a.guestName ?? "לקוח/ה";
}

export function customerOf(db: DB, a: Appointment): User | undefined {
  return a.customerId ? db.users.find((u) => u.id === a.customerId) : undefined;
}

export function NavRow({ to, icon, label, meta }: { to: string; icon: ReactNode; label: string; meta?: ReactNode }) {
  return (
    <Link to={to} className="flex h-16 items-center gap-3 rounded-2xl border border-line px-4 transition hover:bg-surface">
      <span className="grid size-10 place-items-center rounded-full bg-surface">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      {meta}
      <ChevronLeft className="size-5 text-muted" aria-hidden />
    </Link>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 text-2xl font-black">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
