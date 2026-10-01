import "server-only";
import { prisma } from "@/lib/db";

export const appointmentInclude = {
  business: { select: { id: true, slug: true, name: true, address: true, city: true, phone: true, avatarPath: true, timezone: true, isDemo: true } },
  staff: { select: { id: true, name: true } },
  inspirations: { select: { reel: { select: { id: true, thumbPath: true, caption: true } } } },
  sourceReel: { select: { id: true, thumbPath: true, caption: true } },
  review: true,
  events: { orderBy: { createdAt: "asc" as const } },
} as const;

/** Customers can only ever load their own appointments. */
export async function getCustomerAppointment(id: string, userId: string) {
  return prisma.appointment.findFirst({ where: { id, customerId: userId }, include: appointmentInclude });
}
