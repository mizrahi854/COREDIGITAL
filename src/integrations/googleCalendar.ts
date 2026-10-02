import type { Appointment, Business, GoogleCalendarState } from "../domain/types";

/**
 * Calendar sync boundary.
 *
 * The demo ships only SimulatedGoogleCalendar: nothing leaves the browser and no
 * Google account is contacted. A real implementation would:
 *  - Run OAuth 2.0 (authorization code + PKCE) on the server and store refresh tokens server-side only.
 *  - Map each Beautigo appointment to a Google event id (appointment.calendarEventId) and keep that mapping.
 *  - Do a full sync once, then incremental syncs with nextSyncToken; on HTTP 410 (token expired) clear and full-resync.
 *  - Treat invalid_grant / revoked tokens as "disconnected — reconnect required".
 *  - Retry 429/5xx with exponential backoff; make writes idempotent per appointment id.
 *  - Import external busy events only as blocked time; Beautigo stays the source of truth for bookings,
 *    and an external change never silently cancels a Beautigo appointment (raise a conflict for the owner instead).
 */
export interface CalendarSyncAdapter {
  readonly simulated: boolean;
  connect(business: Business): Promise<{ accountEmail: string; calendars: { id: string; name: string }[] }>;
  sync(business: Business, appointments: Appointment[]): Promise<{ syncedAt: string; pushed: number }>;
  disconnect(business: Business): Promise<void>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SimulatedGoogleCalendar implements CalendarSyncAdapter {
  readonly simulated = true;
  async connect(business: Business) {
    await wait(700);
    return {
      accountEmail: `${business.username}@demo.example`,
      calendars: [
        { id: "primary", name: "היומן הראשי (דמו)" },
        { id: `${business.id}-bookings`, name: `תורים — ${business.name} (דמו)` },
        { id: "team", name: "יומן צוות (דמו)" },
      ],
    };
  }
  async sync(business: Business, appointments: Appointment[]) {
    await wait(900);
    if (business.calendar.simulateFailure) throw new Error("invalid_grant: ההרשאה בוטלה או פגה (סימולציה)");
    return { syncedAt: new Date().toISOString(), pushed: appointments.filter((a) => a.status === "confirmed").length };
  }
  async disconnect() {
    await wait(300);
  }
}

export const calendarAdapter: CalendarSyncAdapter = new SimulatedGoogleCalendar();

export function calendarLabel(s: GoogleCalendarState) {
  return s.status === "connected" ? "מחובר (סימולציה)" : s.status === "error" ? "שגיאת סנכרון (סימולציה)" : "לא מחובר";
}
