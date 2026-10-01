"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Send, UserX, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button, Card, Field, Input, Select, Textarea } from "../ui";
import { Sheet } from "../sheet";
import { useToast } from "../toast";
import { SlotPicker, type Slot } from "../booking/slot-picker";

export function BizAppointmentActions({
  appt: a,
  staff,
  timezone,
  isOwner,
}: {
  appt: { id: string; status: string; startsAt: string; serviceId: string | null; staffId: string; durationMin: number; priceAgorot: number; isPast: boolean; hasCustomer: boolean; businessNote: string };
  staff: { id: string; name: string }[];
  timezone: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<"propose" | "reschedule" | "cancel" | "complete" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [staffId, setStaffId] = useState(a.staffId);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [price, setPrice] = useState(String(a.priceAgorot / 100));
  const [duration, setDuration] = useState(String(a.durationMin));
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState(String(a.priceAgorot / 100));
  const [bnote, setBnote] = useState(a.businessNote);

  const run = async (key: string, action: string, body: object, ok: string) => {
    setBusy(key);
    try {
      await apiFetch(`/api/biz/appointments/${a.id}/${action}`, { body });
      toast({ kind: "ok", text: ok });
      setSheet(null);
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const slotsUrl = useCallback(
    (d: string) => {
      if (!a.serviceId) return null;
      const dur = sheet === "propose" ? `&durationMin=${Number(duration) || a.durationMin}` : "";
      const ex = sheet === "reschedule" ? `&exclude=${a.id}` : "";
      return `/api/biz/availability?serviceId=${a.serviceId}&staffId=${staffId}&date=${d}${dur}${ex}`;
    },
    [a, staffId, duration, sheet],
  );

  const pending = a.status === "REQUESTED" || a.status === "PROPOSED";
  return (
    <>
      <Card className="flex flex-wrap gap-2 p-4">
        {pending && (
          <>
            <Button onClick={() => setSheet("propose")}>
              <Send className="size-4" aria-hidden /> {a.status === "PROPOSED" ? "עדכון ההצעה" : "שליחת הצעת מחיר ומועד"}
            </Button>
            <Button variant="danger" loading={busy === "decline"} onClick={() => run("decline", "decline", {}, "הבקשה נדחתה")}>
              דחיית הבקשה
            </Button>
          </>
        )}
        {a.status === "CONFIRMED" && (
          <>
            {a.isPast && (
              <>
                <Button onClick={() => setSheet("complete")}>
                  <CheckCircle2 className="size-4" aria-hidden /> סימון כהושלם
                </Button>
                <Button variant="secondary" loading={busy === "noshow"} onClick={() => run("noshow", "outcome", { outcome: "NO_SHOW" }, "סומן כאי־הגעה")}>
                  <UserX className="size-4" aria-hidden /> לא הגיע/ה
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={() => setSheet("reschedule")} disabled={!a.serviceId}>
              <CalendarClock className="size-4" aria-hidden /> שינוי מועד
            </Button>
            <Button variant="danger" onClick={() => setSheet("cancel")}>
              <XCircle className="size-4" aria-hidden /> ביטול
            </Button>
          </>
        )}
        {isOwner && a.hasCustomer && (
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            loading={busy === "block"}
            onClick={() => confirm("לחסום את הלקוח/ה מקביעת תורים בעסק? תורים קיימים לא יבוטלו.") && run("block", "block-customer", {}, "הלקוח/ה נחסם/ה מהזמנות חדשות")}
          >
            חסימת לקוח/ה
          </Button>
        )}
      </Card>

      <Card className="p-4">
        <Field label="הערה פנימית (לא גלויה ללקוח)" id="bnote">
          <Textarea id="bnote" value={bnote} onChange={(e) => setBnote(e.target.value)} />
        </Field>
        <Button size="sm" variant="secondary" className="mt-2" loading={busy === "note"} onClick={() => run("note", "note", { note: bnote }, "ההערה נשמרה")}>
          שמירת הערה
        </Button>
      </Card>

      <Sheet open={sheet === "propose" || sheet === "reschedule"} onClose={() => setSheet(null)} title={sheet === "propose" ? "הצעת מחיר ומועד" : "שינוי מועד"} className="md:max-w-2xl">
        <div className="flex flex-col gap-4">
          {sheet === "propose" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="מחיר סופי (₪)" id="p-price">
                <Input id="p-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
              <Field label="משך (דקות)" id="p-dur">
                <Input id="p-dur" inputMode="numeric" value={duration} onChange={(e) => { setDuration(e.target.value.replace(/\D/g, "")); setSlot(null); }} />
              </Field>
            </div>
          )}
          {isOwner && staff.length > 1 && (
            <Field label="איש צוות" id="p-staff">
              <Select id="p-staff" value={staffId} onChange={(e) => { setStaffId(e.target.value); setSlot(null); }}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <SlotPicker timezone={timezone} slotsUrl={slotsUrl} date={date} onDate={(d) => { setDate(d); setSlot(null); }} value={slot?.start ?? null} onChange={setSlot} days={30} />
          {sheet === "propose" && <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="הודעה ללקוח/ה (לא חובה)" aria-label="הודעה ללקוח" maxLength={300} />}
          {sheet === "reschedule" && <p className="text-sm text-muted">התור הקיים נשאר במקומו עד שהמועד החדש נשמר בהצלחה.</p>}
          <Button
            size="lg"
            disabled={!slot || (sheet === "propose" && (!price || !duration))}
            loading={busy === "slot"}
            onClick={() =>
              slot &&
              (sheet === "propose"
                ? run("slot", "propose", { startsAt: slot.start, priceAgorot: Math.round(Number(price) * 100), durationMin: Number(duration), staffId, note: note || undefined }, "ההצעה נשלחה ללקוח/ה")
                : run("slot", "reschedule", { startsAt: slot.start, staffId }, "המועד עודכן"))
            }
          >
            {sheet === "propose" ? "שליחת ההצעה" : "שמירת המועד החדש"}
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)} title="ביטול התור">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="סיבה (תוצג ללקוח/ה)" aria-label="סיבת ביטול" />
        <Button variant="danger" size="lg" className="mt-3 w-full" loading={busy === "cancel"} onClick={() => run("cancel", "cancel", { reason: note || undefined }, "התור בוטל והמועד שוחרר")}>
          ביטול התור
        </Button>
      </Sheet>

      <Sheet open={sheet === "complete"} onClose={() => setSheet(null)} title="סימון טיפול כהושלם">
        <Field label="כמה שולם בעסק? (₪)" id="paid" hint="נרשם כתשלום בפועל ומופיע בנפרד מהערך הצפוי. השאירו 0 אם לא שולם.">
          <Input id="paid" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Button size="lg" className="mt-4 w-full" loading={busy === "complete"} onClick={() => run("complete", "outcome", { outcome: "COMPLETED", paidAgorot: Math.round(Number(paid || 0) * 100) }, "הטיפול סומן כהושלם")}>
          שמירה
        </Button>
      </Sheet>
    </>
  );
}
