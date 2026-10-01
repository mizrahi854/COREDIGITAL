import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { api, parseJson } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { cancelAppointment } from "@/server/booking";

type Ctx = { params: Promise<{ kind: string; id: string }> };

const Body = z.object({ action: z.string(), note: z.string().trim().max(500).default("") });

/** All admin operations are recorded in AdminAction. */
export const POST = api<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { kind, id } = await params;
  const { action, note } = await parseJson(req, Body);
  const log = (targetType: string) =>
    prisma.adminAction.create({ data: { adminId: admin.id, action, targetType, targetId: id, note } });

  if (kind === "business") {
    const data =
      action === "approve" ? { status: "APPROVED" as const }
      : action === "suspend" ? { status: "SUSPENDED" as const }
      : action === "verify" ? { verified: true }
      : action === "unverify" ? { verified: false }
      : null;
    if (!data) throw notFound("הפעולה");
    await prisma.business.update({ where: { id }, data });
    await log("business");
    return { ok: true };
  }
  if (kind === "reel") {
    if (action !== "hide" && action !== "unhide") throw notFound("הפעולה");
    await prisma.reel.update({
      where: { id },
      data: { hiddenByAdmin: action === "hide", hiddenReason: action === "hide" ? note || "הוסתר על ידי מנהל" : null },
    });
    await log("reel");
    return { ok: true };
  }
  if (kind === "report") {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw notFound("הדיווח");
    if (action === "hide_target" && report.targetType === "REEL") {
      await prisma.reel.update({ where: { id: report.targetId }, data: { hiddenByAdmin: true, hiddenReason: note || report.reason } });
    }
    if (action === "suspend_target" && report.targetType === "BUSINESS") {
      await prisma.business.update({ where: { id: report.targetId }, data: { status: "SUSPENDED" } });
    }
    await prisma.report.update({
      where: { id },
      data: {
        status: action === "dismiss" ? "DISMISSED" : "RESOLVED",
        resolvedById: admin.id,
        resolution: note || action,
        resolvedAt: new Date(),
      },
    });
    await log("report");
    return { ok: true };
  }
  if (kind === "appointment") {
    if (action !== "cancel") throw notFound("הפעולה");
    await cancelAppointment(id, { kind: "admin", userId: admin.id }, note || "בוטל על ידי מנהל המערכת");
    await log("appointment");
    return { ok: true };
  }
  throw notFound();
});
