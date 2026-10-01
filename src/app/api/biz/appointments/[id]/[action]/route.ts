import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { assertAppointmentScope, requireBusinessAccess } from "@/server/access";
import {
  cancelAppointment,
  declineRequest,
  markOutcome,
  proposeForRequest,
  rescheduleAppointment,
} from "@/server/booking";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const access = await requireBusinessAccess();
  const { id, action } = await params;
  const appt = await prisma.appointment.findUnique({ where: { id }, select: { businessId: true, staffId: true } });
  if (!appt) throw notFound("התור");
  assertAppointmentScope(access, appt);
  const actor = { kind: "business" as const, userId: access.userId };

  switch (action) {
    case "cancel": {
      const b = await parseJson(req, z.object({ reason: z.string().max(300).optional() }));
      return { status: (await cancelAppointment(id, actor, b.reason)).status };
    }
    case "reschedule": {
      const b = await parseJson(req, z.object({ startsAt: z.string().datetime(), staffId: z.string().nullable().optional() }));
      if (access.role === "STAFF") b.staffId = access.staffId;
      return { status: (await rescheduleAppointment(id, actor, b)).status };
    }
    case "propose": {
      const b = await parseJson(
        req,
        z.object({
          startsAt: z.string().datetime(),
          priceAgorot: z.number().int().min(0).max(10_000_000),
          durationMin: z.number().int().min(5).max(600),
          staffId: z.string(),
          note: z.string().max(300).optional(),
        }),
      );
      if (access.role === "STAFF") b.staffId = access.staffId ?? "-";
      return { status: (await proposeForRequest(id, access.userId, access.businessId, b)).status };
    }
    case "decline": {
      const b = await parseJson(req, z.object({ reason: z.string().max(300).optional() }));
      return { status: (await declineRequest(id, access.userId, access.businessId, b.reason)).status };
    }
    case "outcome": {
      const b = await parseJson(
        req,
        z.object({ outcome: z.enum(["COMPLETED", "NO_SHOW"]), paidAgorot: z.number().int().min(0).max(10_000_000).optional() }),
      );
      const a = await markOutcome(id, access.userId, b.outcome, b.paidAgorot ? { amountAgorot: b.paidAgorot } : undefined);
      return { status: a.status };
    }
    case "note": {
      const b = await parseJson(req, z.object({ note: z.string().max(1000) }));
      await prisma.appointment.update({ where: { id }, data: { businessNote: b.note } });
      return { ok: true };
    }
    case "block-customer": {
      if (access.role !== "OWNER") throw notFound("הפעולה");
      const a = await prisma.appointment.findUniqueOrThrow({ where: { id } });
      if (!a.customerId) throw notFound("הלקוח");
      await prisma.businessBlock.upsert({
        where: { businessId_userId: { businessId: access.businessId, userId: a.customerId } },
        create: { businessId: access.businessId, userId: a.customerId },
        update: {},
      });
      return { ok: true };
    }
    default:
      throw notFound("הפעולה");
  }
});
