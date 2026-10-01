import { Prisma, type AppointmentSource } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma, type Tx } from "@/lib/db";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { getSlots, isSlotAvailable } from "./availability";
import { notifyAppointment } from "./notifications";

/**
 * Booking integrity:
 * 1. Availability is recomputed on the server inside the transaction.
 * 2. A per-staff advisory lock serializes concurrent writers for that staff member.
 * 3. The Postgres exclusion constraint "Appointment_no_staff_overlap" is the final
 *    guarantee — two overlapping CONFIRMED rows for one staff member cannot exist.
 * 4. (customerId, idempotencyKey) is unique, so a repeated submission returns
 *    the original appointment instead of creating a second one.
 */

const SLOT_TAKEN = () =>
  conflict("slot_unavailable", "המועד הזה כבר לא פנוי. בחרו שעה אחרת — רשימת השעות עודכנה.");

async function lockStaff(tx: Tx, staffId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"staff:" + staffId}))`;
}

function isOverlapViolation(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("Appointment_no_staff_overlap") || msg.includes("23P01");
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function logEvent(tx: Tx, appointmentId: string, type: string, actorId: string | null, data?: object) {
  await tx.appointmentEvent.create({
    data: { appointmentId, type, actorId, data: data as Prisma.InputJsonValue | undefined },
  });
}

export type CreateBookingInput = {
  customerId: string;
  businessId: string;
  serviceId: string;
  staffId?: string | null;
  startsAt: string; // ISO
  notes?: string;
  inspirationReelIds?: string[];
  sourceReelId?: string | null;
  source?: AppointmentSource;
  idempotencyKey: string;
};

export async function createBooking(input: CreateBookingInput) {
  const existing = await prisma.appointment.findUnique({
    where: { customerId_idempotencyKey: { customerId: input.customerId, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) return { appointment: existing, replayed: true };

  const business = await prisma.business.findUnique({ where: { id: input.businessId } });
  if (!business || business.status !== "APPROVED") throw notFound("העסק");
  const blocked = await prisma.businessBlock.findUnique({
    where: { businessId_userId: { businessId: business.id, userId: input.customerId } },
  });
  if (blocked) throw forbidden();

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, businessId: business.id, active: true },
  });
  if (!service) throw notFound("השירות");

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw badRequest("מועד לא תקין");

  // Inspiration must be published reels (any business) — never private media.
  const inspirationIds = [...new Set(input.inspirationReelIds ?? [])].slice(0, 6);
  if (inspirationIds.length) {
    const ok = await prisma.reel.count({
      where: { id: { in: inspirationIds }, status: "PUBLISHED", hiddenByAdmin: false },
    });
    if (ok !== inspirationIds.length) throw badRequest("אחת ההשראות אינה זמינה");
  }
  let sourceReelId: string | null = null;
  if (input.sourceReelId) {
    const r = await prisma.reel.findFirst({ where: { id: input.sourceReelId, businessId: business.id } });
    sourceReelId = r?.id ?? null;
  }

  // Candidate staff for this exact start.
  let candidates: string[];
  if (input.staffId) {
    candidates = [input.staffId];
  } else {
    const date = DateTime.fromJSDate(startsAt).setZone(business.timezone).toISODate()!;
    const slots = await getSlots({ businessId: business.id, serviceId: service.id, date });
    candidates = slots.find((s) => s.start === startsAt.toISOString())?.staffIds ?? [];
    if (candidates.length === 0) throw SLOT_TAKEN();
  }

  const isConsultation = service.mode === "CONSULTATION";

  for (const staffId of candidates) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await lockStaff(tx, staffId);
        // A concurrent duplicate submission may have committed while we waited for the lock.
        const dup = await tx.appointment.findUnique({
          where: { customerId_idempotencyKey: { customerId: input.customerId, idempotencyKey: input.idempotencyKey } },
        });
        if (dup) return { appointment: dup, replayed: true };
        const free = await isSlotAvailable(
          { businessId: business.id, serviceId: service.id, staffId, startsAt },
          tx,
        );
        if (!free) return null;
        const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
        const a = await tx.appointment.create({
          data: {
            businessId: business.id,
            customerId: input.customerId,
            staffId,
            serviceId: service.id,
            status: isConsultation ? "REQUESTED" : "CONFIRMED",
            startsAt,
            endsAt,
            blockEndsAt: new Date(endsAt.getTime() + service.bufferMin * 60_000),
            serviceName: service.name,
            priceAgorot: service.priceAgorot,
            priceIsFinal: !isConsultation,
            durationMin: service.durationMin,
            bufferMin: service.bufferMin,
            cancellationHours: business.cancellationHours,
            cancellationPolicy: business.cancellationPolicy,
            notes: input.notes?.trim() || null,
            source: sourceReelId ? "REEL" : (input.source ?? "PROFILE"),
            sourceReelId,
            idempotencyKey: input.idempotencyKey,
            createdById: input.customerId,
            inspirations: { create: inspirationIds.map((reelId) => ({ reelId })) },
          },
        });
        await logEvent(tx, a.id, isConsultation ? "requested" : "created", input.customerId);
        await notifyAppointment(tx, a.id, isConsultation ? "booking_requested" : "booking_confirmed");
        return { appointment: a, replayed: false };
      });
      if (result) return result;
    } catch (e) {
      if (isUniqueViolation(e)) {
        const again = await prisma.appointment.findUnique({
          where: {
            customerId_idempotencyKey: { customerId: input.customerId, idempotencyKey: input.idempotencyKey },
          },
        });
        if (again) return { appointment: again, replayed: true };
      }
      if (isOverlapViolation(e)) continue;
      throw e;
    }
  }
  const replay = await prisma.appointment.findUnique({
    where: { customerId_idempotencyKey: { customerId: input.customerId, idempotencyKey: input.idempotencyKey } },
  });
  if (replay) return { appointment: replay, replayed: true };
  throw SLOT_TAKEN();
}

/** Business-side booking for phone/walk-in customers. */
export async function createManualBooking(input: {
  businessId: string;
  actorId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  guestName: string;
  guestPhone?: string;
  notes?: string;
}) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: input.businessId } });
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, businessId: business.id },
  });
  if (!service) throw notFound("השירות");
  const staff = await prisma.staffMember.findFirst({ where: { id: input.staffId, businessId: business.id } });
  if (!staff) throw notFound("איש הצוות");
  const startsAt = new Date(input.startsAt);
  try {
    return await prisma.$transaction(async (tx) => {
      await lockStaff(tx, staff.id);
      const free = await isSlotAvailable(
        { businessId: business.id, serviceId: service.id, staffId: staff.id, startsAt, ignoreLeadTime: true },
        tx,
      );
      if (!free) throw SLOT_TAKEN();
      const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
      const a = await tx.appointment.create({
        data: {
          businessId: business.id,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          staffId: staff.id,
          serviceId: service.id,
          status: "CONFIRMED",
          startsAt,
          endsAt,
          blockEndsAt: new Date(endsAt.getTime() + service.bufferMin * 60_000),
          serviceName: service.name,
          priceAgorot: service.priceAgorot,
          priceIsFinal: true,
          durationMin: service.durationMin,
          bufferMin: service.bufferMin,
          cancellationHours: business.cancellationHours,
          cancellationPolicy: business.cancellationPolicy,
          notes: input.notes || null,
          source: "MANUAL",
          createdById: input.actorId,
        },
      });
      await logEvent(tx, a.id, "created_manual", input.actorId);
      return a;
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw SLOT_TAKEN();
    throw e;
  }
}

export function withinCancellationWindow(a: { startsAt: Date; cancellationHours: number }, now = new Date()) {
  return a.startsAt.getTime() - now.getTime() >= a.cancellationHours * 3600_000;
}

type Actor = { kind: "customer" | "business" | "admin"; userId: string };

export async function cancelAppointment(id: string, actor: Actor, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.appointment.findUnique({ where: { id } });
    if (!a) throw notFound("התור");
    if (actor.kind === "customer" && a.customerId !== actor.userId) throw notFound("התור");
    if (!["CONFIRMED", "REQUESTED", "PROPOSED"].includes(a.status)) {
      throw conflict("not_cancellable", "לא ניתן לבטל תור במצב הנוכחי");
    }
    if (actor.kind === "customer" && a.status === "CONFIRMED" && !withinCancellationWindow(a)) {
      throw new AppError(
        409,
        "policy_window",
        `לפי מדיניות העסק אפשר לבטל עד ${a.cancellationHours} שעות לפני התור. לביטול מאוחר יש לפנות לעסק.`,
      );
    }
    const updated = await tx.appointment.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor.kind, cancelReason: reason ?? null },
    });
    await logEvent(tx, id, "cancelled", actor.userId, { by: actor.kind, reason });
    await notifyAppointment(tx, id, "cancelled");
    return updated;
  });
}

/**
 * Atomic reschedule: the same row moves to the new time inside one transaction.
 * If the new slot is not free, the transaction aborts and the original booking is untouched.
 */
export async function rescheduleAppointment(
  id: string,
  actor: Actor,
  input: { startsAt: string; staffId?: string | null },
) {
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a) throw notFound("התור");
  if (actor.kind === "customer" && a.customerId !== actor.userId) throw notFound("התור");
  if (a.status !== "CONFIRMED") throw conflict("not_reschedulable", "אפשר לשנות מועד רק לתור מאושר");
  if (actor.kind === "customer" && !withinCancellationWindow(a)) {
    throw new AppError(
      409,
      "policy_window",
      `לפי מדיניות העסק אפשר לשנות מועד עד ${a.cancellationHours} שעות לפני התור. לשינוי מאוחר יש לפנות לעסק.`,
    );
  }
  if (!a.serviceId) throw conflict("service_removed", "השירות כבר לא קיים. פנו לעסק לשינוי.");
  const newStart = new Date(input.startsAt);
  const targetStaff = input.staffId ?? a.staffId;
  const staffOk = await prisma.staffMember.findFirst({ where: { id: targetStaff, businessId: a.businessId } });
  if (!staffOk) throw notFound("איש הצוות");

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock in a stable order to avoid deadlocks when two staff are involved.
      for (const s of [...new Set([a.staffId, targetStaff])].sort()) await lockStaff(tx, s);
      const current = await tx.appointment.findUniqueOrThrow({ where: { id } });
      if (current.status !== "CONFIRMED") throw conflict("not_reschedulable", "התור השתנה בינתיים");
      const free = await isSlotAvailable(
        {
          businessId: a.businessId,
          serviceId: a.serviceId!,
          staffId: targetStaff,
          startsAt: newStart,
          excludeAppointmentId: id,
          durationMin: current.durationMin,
          ignoreLeadTime: actor.kind !== "customer",
        },
        tx,
      );
      if (!free) throw SLOT_TAKEN();
      // The agreed duration and buffer travel with the appointment.
      const endsAt = new Date(newStart.getTime() + current.durationMin * 60_000);
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          startsAt: newStart,
          endsAt,
          blockEndsAt: new Date(endsAt.getTime() + current.bufferMin * 60_000),
          staffId: targetStaff,
        },
      });
      await logEvent(tx, id, "rescheduled", actor.userId, {
        by: actor.kind,
        from: current.startsAt.toISOString(),
        to: newStart.toISOString(),
        fromStaff: current.staffId,
        toStaff: targetStaff,
      });
      await notifyAppointment(tx, id, "rescheduled");
      return updated;
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw SLOT_TAKEN();
    throw e;
  }
}

/** Business proposes a final price and time for a consultation request. */
export async function proposeForRequest(
  id: string,
  actorId: string,
  businessId: string,
  input: { startsAt: string; priceAgorot: number; durationMin: number; staffId: string; note?: string },
) {
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a || a.businessId !== businessId) throw notFound("הבקשה");
  if (!["REQUESTED", "PROPOSED"].includes(a.status)) throw conflict("not_pending", "הבקשה כבר טופלה");
  if (!a.serviceId) throw conflict("service_removed", "השירות הוסר");
  const staff = await prisma.staffMember.findFirst({ where: { id: input.staffId, businessId } });
  if (!staff) throw notFound("איש הצוות");
  const startsAt = new Date(input.startsAt);
  const free = await isSlotAvailable({
    businessId,
    serviceId: a.serviceId,
    staffId: staff.id,
    startsAt,
    durationMin: input.durationMin,
    ignoreLeadTime: true,
  });
  if (!free) throw SLOT_TAKEN();
  return prisma.$transaction(async (tx) => {
    const u = await tx.appointment.update({
      where: { id },
      data: {
        status: "PROPOSED",
        proposedStartsAt: startsAt,
        proposedPriceAgorot: input.priceAgorot,
        proposedDurationMin: input.durationMin,
        proposedStaffId: staff.id,
        proposalNote: input.note || null,
      },
    });
    await logEvent(tx, id, "proposed", actorId, input);
    await notifyAppointment(tx, id, "proposal");
    return u;
  });
}

/** Customer accepts the proposal: the slot is revalidated and held atomically. */
export async function acceptProposal(id: string, customerId: string) {
  const a = await prisma.appointment.findUnique({ where: { id } });
  if (!a || a.customerId !== customerId) throw notFound("התור");
  if (a.status !== "PROPOSED" || !a.proposedStartsAt || !a.proposedStaffId || !a.serviceId) {
    throw conflict("no_proposal", "אין הצעה פעילה לאישור");
  }
  const startsAt = a.proposedStartsAt;
  const staffId = a.proposedStaffId;
  const duration = a.proposedDurationMin ?? a.durationMin;
  try {
    return await prisma.$transaction(async (tx) => {
      await lockStaff(tx, staffId);
      const free = await isSlotAvailable(
        { businessId: a.businessId, serviceId: a.serviceId!, staffId, startsAt, durationMin: duration, ignoreLeadTime: true },
        tx,
      );
      if (!free) {
        throw conflict("slot_unavailable", "המועד שהוצע כבר נתפס. ביקשנו מהעסק להציע מועד חדש.");
      }
      const endsAt = new Date(startsAt.getTime() + duration * 60_000);
      const u = await tx.appointment.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          startsAt,
          endsAt,
          blockEndsAt: new Date(endsAt.getTime() + a.bufferMin * 60_000),
          staffId,
          durationMin: duration,
          priceAgorot: a.proposedPriceAgorot ?? a.priceAgorot,
          priceIsFinal: true,
        },
      });
      await logEvent(tx, id, "accepted", customerId);
      await notifyAppointment(tx, id, "proposal_accepted");
      return u;
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw conflict("slot_unavailable", "המועד שהוצע כבר נתפס.");
    if (e instanceof AppError && e.code === "slot_unavailable") {
      await prisma.appointment.update({ where: { id }, data: { status: "REQUESTED" } });
    }
    throw e;
  }
}

export async function declineRequest(id: string, actorId: string, businessId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.appointment.findUnique({ where: { id } });
    if (!a || a.businessId !== businessId) throw notFound("הבקשה");
    if (!["REQUESTED", "PROPOSED"].includes(a.status)) throw conflict("not_pending", "הבקשה כבר טופלה");
    const u = await tx.appointment.update({
      where: { id },
      data: { status: "DECLINED", cancelReason: reason ?? null, cancelledBy: "business", cancelledAt: new Date() },
    });
    await logEvent(tx, id, "declined", actorId, { reason });
    await notifyAppointment(tx, id, "declined");
    return u;
  });
}

export async function markOutcome(
  id: string,
  actorId: string,
  outcome: "COMPLETED" | "NO_SHOW",
  payment?: { amountAgorot: number },
) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.appointment.findUniqueOrThrow({ where: { id } });
    if (a.status !== "CONFIRMED") throw conflict("bad_state", "אפשר לסמן רק תור מאושר");
    if (a.startsAt > new Date()) throw conflict("future", "אי אפשר לסמן תור שעוד לא התחיל");
    const u = await tx.appointment.update({
      where: { id },
      data: { status: outcome, completedAt: outcome === "COMPLETED" ? new Date() : null },
    });
    if (outcome === "COMPLETED" && payment && payment.amountAgorot > 0) {
      await tx.paymentRecord.create({
        data: { appointmentId: id, amountAgorot: payment.amountAgorot, method: "at_business", recordedById: actorId },
      });
    }
    await logEvent(tx, id, outcome === "COMPLETED" ? "completed" : "no_show", actorId, payment);
    return u;
  });
}
