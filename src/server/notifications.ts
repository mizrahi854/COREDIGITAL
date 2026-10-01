import { DateTime } from "luxon";
import { prisma, type Tx } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";

/**
 * Notification records are written inside the same transaction as the
 * appointment change, then delivered by the job worker when due.
 *
 * Delivery goes through a provider adapter. Without credentials the
 * "dev-log" provider records the message as LOGGED — it is never shown
 * as delivered.
 */

export interface DeliveryProvider {
  name: string;
  channel: "email" | "sms";
  send(msg: { to: string; subject: string; body: string }): Promise<{ externalId?: string }>;
}

class DevLogProvider implements DeliveryProvider {
  name = "dev-log";
  constructor(public channel: "email" | "sms") {}
  async send() {
    return {};
  }
}

export function providerFor(channel: "email" | "sms"): DeliveryProvider {
  // Production: implement e.g. an SMTP/Resend email provider or an SMS gateway
  // provider here when EMAIL_PROVIDER / SMS_PROVIDER credentials are configured.
  return new DevLogProvider(channel);
}

type ApptForNotify = {
  id: string;
  startsAt: Date;
  serviceName: string;
  priceAgorot: number;
  priceIsFinal: boolean;
  cancellationPolicy: string;
  customerId: string | null;
  business: { name: string; address: string; city: string; timezone: string };
  customer: { email: string; name: string } | null;
};

async function load(db: Tx, appointmentId: string): Promise<ApptForNotify | null> {
  return db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      startsAt: true,
      serviceName: true,
      priceAgorot: true,
      priceIsFinal: true,
      cancellationPolicy: true,
      customerId: true,
      business: { select: { name: true, address: true, city: true, timezone: true } },
      customer: { select: { email: true, name: true } },
    },
  });
}

export type NotifyKind =
  | "booking_confirmed"
  | "booking_requested"
  | "proposal"
  | "proposal_accepted"
  | "rescheduled"
  | "cancelled"
  | "declined";

const SUBJECTS: Record<NotifyKind, string> = {
  booking_confirmed: "התור שלך אושר",
  booking_requested: "הבקשה שלך נשלחה לעסק",
  proposal: "העסק שלח לך הצעת מחיר ומועד",
  proposal_accepted: "התור שלך אושר",
  rescheduled: "מועד התור עודכן",
  cancelled: "התור בוטל",
  declined: "הבקשה נדחתה",
};

export async function notifyAppointment(db: Tx, appointmentId: string, kind: NotifyKind) {
  const a = await load(db, appointmentId);
  if (!a || !a.customer) return; // manual bookings without an account get no automatic message
  const when = formatDateTime(a.startsAt, a.business.timezone);
  const price = formatPrice(a.priceAgorot, { from: !a.priceIsFinal });
  const body = [
    `שלום ${a.customer.name},`,
    `${SUBJECTS[kind]}: ${a.serviceName} ב${a.business.name}.`,
    `מועד: ${when}. מחיר: ${price}.`,
    `כתובת: ${[a.business.address, a.business.city].filter(Boolean).join(", ")}.`,
    `מדיניות ביטול: ${a.cancellationPolicy}`,
  ].join("\n");
  await db.notification.create({
    data: {
      appointmentId: a.id,
      userId: a.customerId,
      channel: "email",
      recipient: a.customer.email,
      template: kind,
      subject: SUBJECTS[kind],
      body,
      scheduledFor: new Date(),
    },
  });
  if (kind === "cancelled" || kind === "declined" || kind === "rescheduled") {
    await cancelReminders(db, a.id);
  }
  if (kind === "booking_confirmed" || kind === "proposal_accepted" || kind === "rescheduled") {
    await scheduleReminder(db, a);
  }
}

async function scheduleReminder(db: Tx, a: ApptForNotify) {
  if (!a.customer) return;
  const at = DateTime.fromJSDate(a.startsAt).minus({ hours: 24 });
  if (at.toMillis() <= Date.now()) return; // too late for a 24h reminder
  await db.notification.create({
    data: {
      appointmentId: a.id,
      userId: a.customerId,
      channel: "email",
      recipient: a.customer.email,
      template: "reminder_24h",
      subject: "תזכורת: התור שלך מחר",
      body: `תזכורת: ${a.serviceName} ב${a.business.name}, ${formatDateTime(a.startsAt, a.business.timezone)}.\n${a.cancellationPolicy}`,
      scheduledFor: at.toJSDate(),
    },
  });
}

export async function cancelReminders(db: Tx, appointmentId: string) {
  await db.notification.updateMany({
    where: { appointmentId, template: "reminder_24h", status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

/** Called by the worker. Claims due notifications with SKIP LOCKED so several workers can run. */
export async function deliverDueNotifications(batch = 20) {
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Notification" SET "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "status" = 'PENDING' AND "scheduledFor" <= now() AND "attempts" < 5
      ORDER BY "scheduledFor" LIMIT ${batch}
      FOR UPDATE SKIP LOCKED
    ) RETURNING "id"`;
  for (const { id } of claimed) {
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.status !== "PENDING") continue;
    const provider = providerFor(n.channel as "email" | "sms");
    try {
      await provider.send({ to: n.recipient, subject: n.subject, body: n.body });
      await prisma.notification.update({
        where: { id },
        data: {
          status: provider.name === "dev-log" ? "LOGGED" : "SENT",
          provider: provider.name,
          sentAt: new Date(),
        },
      });
    } catch (e) {
      await prisma.notification.update({
        where: { id },
        data: {
          lastError: String(e),
          status: n.attempts >= 5 ? "FAILED" : "PENDING",
          scheduledFor: new Date(Date.now() + 60_000 * n.attempts),
        },
      });
    }
  }
  return claimed.length;
}
