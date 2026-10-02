import type { Appointment, Business, DB, ID, Post, User } from "./types";

/**
 * Role-based permissions for the local demo.
 * These checks run inside every store action (not only in the UI), so a hidden
 * button cannot be bypassed from the console. They are NOT production security:
 * a real deployment must enforce the same rules on the server.
 */

export type Viewer = User | null;

export class PermissionError extends Error {
  constructor(message = "אין לך הרשאה לפעולה הזו") {
    super(message);
  }
}

export const isGuest = (v: Viewer): v is null => v === null;
export const isCustomer = (v: Viewer) => v?.role === "customer";
export const isOwner = (v: Viewer, businessId?: ID) => v?.role === "business" && (!businessId || v.businessId === businessId);
export const isStaff = (v: Viewer, businessId?: ID) => v?.role === "staff" && (!businessId || v.businessId === businessId);
export const isAdmin = (v: Viewer) => v?.role === "admin";

export const can = {
  /** Booking requires a customer account (guests are asked to sign in). */
  book: (v: Viewer) => isCustomer(v),
  /** Like, save, follow, comment, message. */
  interact: (v: Viewer) => !!v && v.status === "active" && v.role !== "admin",
  /** Only businesses publish posts, reels and carousels. Customers never get a create button. */
  createContent: (v: Viewer) => v?.role === "business" && !!v.businessId,
  editPost: (v: Viewer, post: Post) => isOwner(v, post.businessId),
  manageBusiness: (v: Viewer, businessId: ID) => isOwner(v, businessId),
  /** Owner sees the whole calendar; staff only their own professional column. */
  viewCalendar: (v: Viewer, businessId: ID) => isOwner(v, businessId) || isStaff(v, businessId),
  viewAppointment: (v: Viewer, a: Appointment) =>
    !!v &&
    (v.id === a.customerId ||
      isOwner(v, a.businessId) ||
      (isStaff(v, a.businessId) && v.professionalId === a.professionalId) ||
      isAdmin(v)),
  manageAppointment: (v: Viewer, a: Appointment) => isOwner(v, a.businessId) || (isStaff(v, a.businessId) && v?.professionalId === a.professionalId),
  replyToReview: (v: Viewer, businessId: ID) => isOwner(v, businessId),
  /** Nobody deletes reviews; only administrators can hide them (with a reason). */
  hideReview: (v: Viewer) => isAdmin(v),
  admin: (v: Viewer) => isAdmin(v),
};

export function assert(ok: boolean, message?: string): asserts ok {
  if (!ok) throw new PermissionError(message);
}

export function viewerBusiness(db: DB, v: Viewer): Business | undefined {
  if (!v?.businessId) return undefined;
  return db.businesses.find((b) => b.id === v.businessId);
}
