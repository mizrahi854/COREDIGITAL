import { DateTime } from "luxon";
import type { Appointment, AppointmentStatus, Business, DB, ID, Service, User } from "./types";
import { TZ, atMinute, dayStart, overlaps, weekday } from "./time";
import { uid } from "./ids";
import { notify } from "./notify";

/**
 * Booking rules for the local demo repository.
 *
 * Production note: this check-then-write runs in one synchronous JS turn, which is
 * enough for a single-device demo. A real backend must enforce it transactionally
 * on the server (row locks / exclusion constraint) because two devices can race.
 */

export const SLOT_STEP_MIN = 15;
export const MIN_LEAD_MIN = 30;
export const MAX_ADVANCE_DAYS = 60;

export class BookingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Statuses that occupy the professional's time. Pending holds count until they expire. */
export function holdsSlot(a: Appointment, now: Date) {
  if (a.status === "confirmed" || a.status === "completed") return true;
  if (a.status === "pending_approval" || a.status === "pending_payment") {
    return !a.holdExpiresAt || new Date(a.holdExpiresAt) > now;
  }
  return false;
}

export type Slot = { start: string; professionalIds: ID[] };

export function getSlots(
  db: DB,
  q: { businessId: ID; serviceId: ID; date: string; professionalId?: ID | null; excludeAppointmentId?: ID; durationMin?: number; ignoreLead?: boolean },
  now = new Date(),
): Slot[] {
  const service = db.services.find((s) => s.id === q.serviceId && s.businessId === q.businessId && s.active);
  const business = db.businesses.find((b) => b.id === q.businessId);
  if (!service || !business || business.status !== "active") return [];
  const day = dayStart(q.date);
  if (!day.isValid) return [];
  const dayEnd = day.plus({ days: 1 });
  const wd = weekday(day);
  const nowMs = now.getTime();
  const earliest = q.ignoreLead ? nowMs : nowMs + MIN_LEAD_MIN * 60_000;
  const latest = nowMs + MAX_ADVANCE_DAYS * 86_400_000;
  const duration = q.durationMin ?? service.durationMin;
  const block = (duration + service.bufferMin) * 60_000;
  const step = SLOT_STEP_MIN * 60_000;

  const pros = db.professionals.filter(
    (p) => p.businessId === q.businessId && p.active && p.serviceIds.includes(service.id) && (!q.professionalId || p.id === q.professionalId),
  );
  const result = new Map<number, ID[]>();
  for (const p of pros) {
    const busy: [number, number][] = [
      ...p.breaks.filter((b) => b.weekday === wd).map((b) => [atMinute(day, b.start).toMillis(), atMinute(day, b.end).toMillis()] as [number, number]),
      ...db.blockedTimes
        .filter((b) => b.professionalId === p.id)
        .map((b) => [Date.parse(b.start), Date.parse(b.end)] as [number, number]),
      ...db.appointments
        .filter((a) => a.professionalId === p.id && a.id !== q.excludeAppointmentId && holdsSlot(a, now))
        .map((a) => [Date.parse(a.start), Date.parse(a.end) + a.snapshot.bufferMin * 60_000] as [number, number]),
    ].filter(([s, e]) => s < dayEnd.toMillis() && e > day.toMillis());

    for (const w of p.workingHours.filter((h) => h.weekday === wd)) {
      const ws = atMinute(day, w.start).toMillis();
      const we = atMinute(day, w.end).toMillis();
      for (let t = ws; t + block <= we; t += step) {
        if (t < earliest || t > latest) continue;
        if (busy.some(([s, e]) => overlaps(t, t + block, s, e))) continue;
        result.set(t, [...(result.get(t) ?? []), p.id]);
      }
    }
  }
  return [...result.entries()].sort((a, b) => a[0] - b[0]).map(([t, ids]) => ({ start: new Date(t).toISOString(), professionalIds: ids }));
}

export function isSlotFree(db: DB, args: { businessId: ID; serviceId: ID; professionalId: ID; start: string; excludeAppointmentId?: ID; durationMin?: number; ignoreLead?: boolean }, now = new Date()) {
  const date = DateTime.fromISO(args.start).setZone(TZ).toISODate()!;
  return getSlots(db, { ...args, date }, now).some((s) => s.start === new Date(args.start).toISOString() && s.professionalIds.includes(args.professionalId));
}

/** Days with at least one free slot (date strip). */
export function availableDays(db: DB, q: { businessId: ID; serviceId: ID; professionalId?: ID | null }, days = 21, now = new Date()) {
  const start = DateTime.fromJSDate(now).setZone(TZ).startOf("day");
  return Array.from({ length: days }, (_, i) => {
    const date = start.plus({ days: i }).toISODate()!;
    return { date, count: getSlots(db, { ...q, date }, now).length };
  });
}

export function depositFor(service: Service) {
  if (service.payment !== "deposit") return 0;
  return service.deposit.type === "fixed" ? service.deposit.value : Math.round((service.price * service.deposit.value) / 100);
}

export function snapshotOf(service: Service, business: Business) {
  return {
    serviceName: service.name,
    price: service.price,
    priceFrom: service.priceFrom,
    durationMin: service.durationMin,
    bufferMin: service.bufferMin,
    approval: service.approval,
    payment: service.payment,
    deposit: depositFor(service),
    cancelHours: business.policy.cancelHours,
    policyText: business.policy.text,
    address: business.address,
  };
}

function initialStatus(service: Service): AppointmentStatus {
  if (service.approval === "manual") return "pending_approval";
  if (service.payment === "deposit") return "pending_payment";
  return "confirmed";
}

function holdUntil(status: AppointmentStatus, business: Business, now: Date) {
  if (status === "pending_approval") return new Date(now.getTime() + business.policy.requestExpiryHours * 3600_000).toISOString();
  if (status === "pending_payment") return new Date(now.getTime() + business.policy.paymentHoldMinutes * 60_000).toISOString();
  return undefined;
}

export function log(a: Appointment, by: string, action: string, detail?: string, now = new Date()) {
  a.history.push({ at: now.toISOString(), by, action, detail });
}

export interface BookingInput {
  customer: User;
  businessId: ID;
  serviceId: ID;
  professionalId: ID | null;
  start: string;
  note?: string;
  inspirationPostIds: ID[];
  sourcePostId?: ID;
}

/** Validates against current availability and creates the appointment in the draft DB. */
export function createBooking(db: DB, input: BookingInput, now = new Date()): Appointment {
  if (input.customer.role !== "customer") throw new BookingError("forbidden", "רק חשבון לקוח יכול לקבוע תור");
  const business = db.businesses.find((b) => b.id === input.businessId);
  const service = db.services.find((s) => s.id === input.serviceId && s.businessId === input.businessId);
  if (!business || business.status !== "active") throw new BookingError("unavailable", "העסק אינו זמין להזמנות כרגע");
  if (!service || !service.active) throw new BookingError("unavailable", "השירות אינו זמין");
  if (input.customer.blockedBusinessIds.includes(business.id)) throw new BookingError("blocked", "חסמת את העסק הזה");

  const date = DateTime.fromISO(input.start).setZone(TZ).toISODate()!;
  const slot = getSlots(db, { businessId: business.id, serviceId: service.id, date, professionalId: input.professionalId }, now).find(
    (s) => s.start === new Date(input.start).toISOString(),
  );
  if (!slot) throw new BookingError("slot_taken", "המועד כבר לא פנוי. בחרו שעה אחרת.");
  const professionalId = input.professionalId ?? leastBusy(db, slot.professionalIds, date);

  const status = initialStatus(service);
  const start = new Date(input.start);
  const a: Appointment = {
    id: uid("apt"),
    businessId: business.id,
    customerId: input.customer.id,
    professionalId,
    serviceId: service.id,
    snapshot: snapshotOf(service, business),
    start: start.toISOString(),
    end: new Date(start.getTime() + service.durationMin * 60_000).toISOString(),
    status,
    holdExpiresAt: holdUntil(status, business, now),
    sourcePostId: input.sourcePostId,
    inspirationPostIds: [...new Set(input.inspirationPostIds)].slice(0, 6),
    note: input.note?.trim() || undefined,
    payment: { status: "none", amount: 0 },
    history: [],
    createdAt: now.toISOString(),
    createdBy: "customer",
  };
  log(a, input.customer.id, "created", status, now);
  db.appointments.push(a);

  const owner = business.ownerId;
  if (status === "pending_approval") {
    notify(db, owner, "appointments", "בקשת תור חדשה", `${input.customer.name} מבקש/ת ${service.name}`, `/manage/appointments/${a.id}`);
    notify(db, input.customer.id, "appointments", "הבקשה נשלחה", `${business.name} יאשרו או ידחו את הבקשה`, `/appointments/${a.id}`);
  } else if (status === "confirmed") {
    notify(db, owner, "appointments", "תור חדש נקבע", `${input.customer.name} · ${service.name}`, `/manage/appointments/${a.id}`);
    notify(db, input.customer.id, "appointments", "התור אושר", `${service.name} ב${business.name}`, `/appointments/${a.id}`);
  }
  return a;
}

function leastBusy(db: DB, ids: ID[], date: string) {
  const count = (id: ID) => db.appointments.filter((a) => a.professionalId === id && a.start.startsWith(date)).length;
  return [...ids].sort((x, y) => count(x) - count(y))[0];
}

/** Demo payment of the deposit. Never touches real card data. */
export function payDeposit(db: DB, appointmentId: ID, customerId: ID, outcome: "success" | "failure", now = new Date()) {
  const a = mustGet(db, appointmentId);
  if (a.customerId !== customerId) throw new BookingError("forbidden", "אין גישה לתור הזה");
  if (a.status !== "pending_payment") throw new BookingError("state", "התור אינו ממתין לתשלום");
  if (!holdsSlot(a, now)) throw new BookingError("expired", "זמן ההחזקה של המועד פג. בחרו מועד מחדש.");
  const record = { id: uid("pay"), appointmentId: a.id, businessId: a.businessId, customerId, amount: a.snapshot.deposit, createdAt: now.toISOString() };
  if (outcome === "failure") {
    a.payment = { status: "failed_demo", amount: 0 };
    db.payments.push({ ...record, status: "failed_demo" });
    log(a, customerId, "payment_failed", undefined, now);
    return a;
  }
  a.payment = { status: "paid_demo", amount: a.snapshot.deposit };
  db.payments.push({ ...record, status: "succeeded_demo" });
  a.status = "confirmed";
  a.holdExpiresAt = undefined;
  log(a, customerId, "deposit_paid", String(a.snapshot.deposit), now);
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  notify(db, b.ownerId, "appointments", "מקדמה שולמה (דמו)", a.snapshot.serviceName, `/manage/appointments/${a.id}`);
  notify(db, customerId, "appointments", "התור אושר", `${a.snapshot.serviceName} ב${b.name}`, `/appointments/${a.id}`);
  return a;
}

export function approve(db: DB, appointmentId: ID, actorId: ID, now = new Date()) {
  const a = mustGet(db, appointmentId);
  if (a.status !== "pending_approval") throw new BookingError("state", "הבקשה כבר טופלה");
  if (!holdsSlot(a, now)) throw new BookingError("expired", "תוקף הבקשה פג והמועד שוחרר");
  a.status = a.snapshot.payment === "deposit" ? "pending_payment" : "confirmed";
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  a.holdExpiresAt = a.status === "pending_payment" ? new Date(now.getTime() + b.policy.paymentHoldMinutes * 60_000).toISOString() : undefined;
  log(a, actorId, "approved", undefined, now);
  if (a.customerId) {
    notify(
      db,
      a.customerId,
      "appointments",
      a.status === "confirmed" ? "הבקשה אושרה" : "הבקשה אושרה — נדרשת מקדמה",
      `${a.snapshot.serviceName} ב${b.name}`,
      `/appointments/${a.id}`,
    );
  }
  return a;
}

export function reject(db: DB, appointmentId: ID, actorId: ID, reason: string, now = new Date()) {
  const a = mustGet(db, appointmentId);
  if (a.status !== "pending_approval") throw new BookingError("state", "הבקשה כבר טופלה");
  a.status = "rejected";
  a.cancelReason = reason || undefined;
  a.holdExpiresAt = undefined;
  log(a, actorId, "rejected", reason, now);
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  if (a.customerId) notify(db, a.customerId, "appointments", "הבקשה נדחתה", `${b.name}${reason ? `: ${reason}` : ""}`, `/appointments/${a.id}`);
  return a;
}

export function canCustomerChange(a: Appointment, now = new Date()) {
  return new Date(a.start).getTime() - now.getTime() >= a.snapshot.cancelHours * 3600_000;
}

export function cancel(db: DB, appointmentId: ID, actor: { id: ID; kind: "customer" | "business" | "admin" }, reason: string, now = new Date()) {
  const a = mustGet(db, appointmentId);
  if (actor.kind === "customer" && a.customerId !== actor.id) throw new BookingError("forbidden", "אין גישה לתור הזה");
  if (!["pending_approval", "pending_payment", "confirmed"].includes(a.status)) throw new BookingError("state", "אי אפשר לבטל תור במצב הזה");
  a.status = "cancelled";
  a.cancelledBy = actor.kind;
  a.cancelReason = reason || undefined;
  a.holdExpiresAt = undefined;
  log(a, actor.id, "cancelled", reason, now);
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  if (actor.kind !== "customer" && a.customerId) notify(db, a.customerId, "appointments", "התור בוטל", `${a.snapshot.serviceName} ב${b.name}`, `/appointments/${a.id}`);
  if (actor.kind !== "business") notify(db, b.ownerId, "appointments", "תור בוטל", `${a.snapshot.serviceName} · ${a.guestName ?? ""}`, `/manage/appointments/${a.id}`);
  return a;
}

/** Same appointment record moves; if the target is not free nothing changes. */
export function reschedule(
  db: DB,
  appointmentId: ID,
  actor: { id: ID; kind: "customer" | "business" },
  input: { start: string; professionalId?: ID },
  now = new Date(),
) {
  const a = mustGet(db, appointmentId);
  if (actor.kind === "customer" && a.customerId !== actor.id) throw new BookingError("forbidden", "אין גישה לתור הזה");
  if (!["pending_approval", "pending_payment", "confirmed"].includes(a.status)) throw new BookingError("state", "אפשר לשנות רק תור פעיל");
  const professionalId = input.professionalId ?? a.professionalId;
  const free = isSlotFree(
    db,
    {
      businessId: a.businessId,
      serviceId: a.serviceId,
      professionalId,
      start: input.start,
      excludeAppointmentId: a.id,
      durationMin: a.snapshot.durationMin,
      ignoreLead: actor.kind === "business",
    },
    now,
  );
  if (!free) throw new BookingError("slot_taken", "המועד החדש לא פנוי. התור המקורי נשאר במקומו.");
  const from = a.start;
  const start = new Date(input.start);
  a.start = start.toISOString();
  a.end = new Date(start.getTime() + a.snapshot.durationMin * 60_000).toISOString();
  a.professionalId = professionalId;
  log(a, actor.id, "rescheduled", `${from} → ${a.start}`, now);
  const b = db.businesses.find((x) => x.id === a.businessId)!;
  if (actor.kind === "business" && a.customerId) notify(db, a.customerId, "appointments", "מועד התור שונה", `${a.snapshot.serviceName} ב${b.name}`, `/appointments/${a.id}`);
  if (actor.kind === "customer") notify(db, b.ownerId, "appointments", "לקוח/ה שינה/תה מועד", a.snapshot.serviceName, `/manage/appointments/${a.id}`);
  return a;
}

export function markOutcome(db: DB, appointmentId: ID, actorId: ID, outcome: "completed" | "no_show", now = new Date()) {
  const a = mustGet(db, appointmentId);
  if (a.status !== "confirmed") throw new BookingError("state", "אפשר לסמן רק תור מאושר");
  if (new Date(a.start) > now) throw new BookingError("future", "התור עוד לא התחיל");
  a.status = outcome;
  log(a, actorId, outcome, undefined, now);
  if (outcome === "completed" && a.customerId) {
    const b = db.businesses.find((x) => x.id === a.businessId)!;
    notify(db, a.customerId, "appointments", "איך היה?", `אפשר לכתוב ביקורת על ${a.snapshot.serviceName} ב${b.name}`, `/appointments/${a.id}`);
  }
  return a;
}

/** Releases expired pending holds. Run on load and periodically. */
export function expireHolds(db: DB, now = new Date()) {
  let changed = 0;
  for (const a of db.appointments) {
    if ((a.status === "pending_approval" || a.status === "pending_payment") && a.holdExpiresAt && new Date(a.holdExpiresAt) <= now) {
      a.status = "cancelled";
      a.cancelledBy = "system";
      a.cancelReason = "פג תוקף ההחזקה — המועד שוחרר";
      log(a, "system", "expired", undefined, now);
      if (a.customerId) notify(db, a.customerId, "appointments", "פג תוקף הבקשה", `${a.snapshot.serviceName} — המועד שוחרר`, `/appointments/${a.id}`);
      changed++;
    }
  }
  return changed;
}

export function createManual(
  db: DB,
  input: { businessId: ID; actorId: ID; serviceId: ID; professionalId: ID; start: string; guestName: string; guestPhone?: string; note?: string },
  now = new Date(),
) {
  const business = db.businesses.find((b) => b.id === input.businessId)!;
  const service = db.services.find((s) => s.id === input.serviceId && s.businessId === business.id);
  if (!service) throw new BookingError("unavailable", "השירות לא נמצא");
  if (!isSlotFree(db, { ...input, ignoreLead: true }, now)) throw new BookingError("slot_taken", "המועד תפוס");
  const start = new Date(input.start);
  const a: Appointment = {
    id: uid("apt"),
    businessId: business.id,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    professionalId: input.professionalId,
    serviceId: service.id,
    snapshot: snapshotOf(service, business),
    start: start.toISOString(),
    end: new Date(start.getTime() + service.durationMin * 60_000).toISOString(),
    status: "confirmed",
    inspirationPostIds: [],
    businessNote: input.note,
    payment: { status: "none", amount: 0 },
    history: [],
    createdAt: now.toISOString(),
    createdBy: "business",
  };
  log(a, input.actorId, "created_manual", undefined, now);
  db.appointments.push(a);
  return a;
}

export function addBlockedTime(db: DB, input: { businessId: ID; professionalId: ID; start: string; end: string; reason: string }) {
  if (new Date(input.end) <= new Date(input.start)) throw new BookingError("invalid", "טווח זמנים לא תקין");
  const b = { id: uid("blk"), ...input };
  db.blockedTimes.push(b);
  return b;
}

export function mustGet(db: DB, id: ID) {
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new BookingError("not_found", "התור לא נמצא");
  return a;
}

export const ACTIVE_STATUSES: AppointmentStatus[] = ["pending_approval", "pending_payment", "confirmed"];
