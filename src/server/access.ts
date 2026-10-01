import "server-only";
import { prisma } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/errors";
import { getSession } from "./auth";

export type BusinessAccess = {
  userId: string;
  businessId: string;
  role: "OWNER" | "STAFF";
  /** Staff member profile of this user inside the business, if any. */
  staffId: string | null;
};

/**
 * Resolves the business the current session is managing and the caller's role in it.
 * Every business API goes through here: membership is checked against the database,
 * never trusted from the client.
 */
export async function requireBusinessAccess(opts: { ownerOnly?: boolean; businessId?: string } = {}) {
  const s = await getSession();
  if (!s) throw unauthorized();
  const businessId = opts.businessId ?? s.businessId ?? s.user.memberships[0]?.businessId;
  if (!businessId) throw forbidden();
  const member = s.user.memberships.find((m) => m.businessId === businessId);
  if (!member) throw forbidden();
  if (opts.ownerOnly && member.role !== "OWNER") throw forbidden();
  const staff = await prisma.staffMember.findFirst({
    where: { businessId, userId: s.userId },
    select: { id: true },
  });
  return {
    userId: s.userId,
    businessId,
    role: member.role,
    staffId: staff?.id ?? null,
  } satisfies BusinessAccess;
}

/** Throws unless the appointment belongs to the business and (for staff) to the staff member. */
export function assertAppointmentScope(
  access: BusinessAccess,
  appt: { businessId: string; staffId: string },
) {
  if (appt.businessId !== access.businessId) throw forbidden();
  if (access.role === "STAFF" && appt.staffId !== access.staffId) throw forbidden();
}
