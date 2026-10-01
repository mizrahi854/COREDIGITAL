import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { api, limit, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { acceptProposal, cancelAppointment, rescheduleAppointment } from "@/server/booking";
import { publicReelWhere } from "@/server/feed";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  await limit(req, "appt-action", 60, 600, user.id);
  const { id, action } = await params;
  const actor = { kind: "customer" as const, userId: user.id };

  switch (action) {
    case "cancel": {
      const b = await parseJson(req, z.object({ reason: z.string().max(300).optional() }));
      const a = await cancelAppointment(id, actor, b.reason);
      return { status: a.status };
    }
    case "reschedule": {
      const b = await parseJson(req, z.object({ startsAt: z.string().datetime(), staffId: z.string().nullable().optional() }));
      const a = await rescheduleAppointment(id, actor, b);
      return { status: a.status, startsAt: a.startsAt };
    }
    case "accept": {
      const a = await acceptProposal(id, user.id);
      return { status: a.status };
    }
    case "decline-proposal": {
      const a = await cancelAppointment(id, actor, "הלקוח/ה דחה/תה את ההצעה");
      return { status: a.status };
    }
    case "review": {
      const b = await parseJson(
        req,
        z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().max(1000).optional() }),
      );
      const a = await prisma.appointment.findFirst({ where: { id, customerId: user.id } });
      if (!a) throw notFound("התור");
      if (a.status !== "COMPLETED") throw conflict("not_completed", "אפשר לדרג רק אחרי טיפול שהושלם");
      const existing = await prisma.review.findUnique({ where: { appointmentId: id } });
      if (existing) throw conflict("already_reviewed", "כבר דירגת את הטיפול הזה");
      await prisma.review.create({
        data: { appointmentId: id, businessId: a.businessId, customerId: user.id, rating: b.rating, text: b.text ?? "" },
      });
      return { ok: true };
    }
    case "inspiration": {
      const b = await parseJson(req, z.object({ reelIds: z.array(z.string()).max(6) }));
      const a = await prisma.appointment.findFirst({ where: { id, customerId: user.id } });
      if (!a) throw notFound("התור");
      if (!["CONFIRMED", "REQUESTED", "PROPOSED"].includes(a.status)) {
        throw conflict("closed", "אפשר לצרף השראה רק לתור פעיל");
      }
      const valid = await prisma.reel.findMany({ where: { id: { in: b.reelIds }, ...publicReelWhere }, select: { id: true } });
      await prisma.$transaction([
        prisma.appointmentInspiration.deleteMany({ where: { appointmentId: id } }),
        prisma.appointmentInspiration.createMany({ data: valid.map((r) => ({ appointmentId: id, reelId: r.id })) }),
      ]);
      return { ok: true, count: valid.length };
    }
    default:
      throw notFound("הפעולה");
  }
});
