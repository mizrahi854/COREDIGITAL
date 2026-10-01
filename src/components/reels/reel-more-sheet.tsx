"use client";

import { useState } from "react";
import Link from "next/link";
import { EyeOff, Flag, FolderPlus, Store } from "lucide-react";
import type { ReelDTO } from "@/server/feed";
import { apiFetch } from "@/lib/client";
import { Sheet } from "../sheet";
import { Button, Textarea } from "../ui";
import { useToast } from "../toast";
import { useViewer } from "../viewer";
import { REPORT_REASONS } from "@/lib/constants";

export function ReelMoreSheet({
  open,
  onClose,
  reel,
  onHidden,
  onAddToCollection,
}: {
  open: boolean;
  onClose: () => void;
  reel: ReelDTO;
  onHidden: () => void;
  onAddToCollection: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "report">("menu");
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { requireAuth } = useViewer();

  const close = () => {
    setMode("menu");
    onClose();
  };

  const report = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/reports", { body: { targetType: "REEL", targetId: reel.id, reason, details } });
      toast({ kind: "ok", text: "הדיווח התקבל ויועבר לבדיקת צוות BUBER" });
      close();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const hide = async () => {
    if (!requireAuth("התחברו כדי להסתיר עסקים מהפיד שלכם.")) return;
    try {
      await apiFetch("/api/social", { body: { action: "block", targetId: reel.business.id, on: true } });
      toast({ kind: "ok", text: `${reel.business.name} לא יופיע יותר בפיד ובחיפוש. אפשר לבטל בפרופיל.` });
      close();
      onHidden();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    }
  };

  const item = "flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-start font-medium transition hover:bg-sand";
  return (
    <Sheet open={open} onClose={close} title={mode === "menu" ? "אפשרויות" : "דיווח על הסרטון"}>
      {mode === "menu" ? (
        <div className="flex flex-col">
          <button className={item} onClick={onAddToCollection}>
            <FolderPlus className="size-5 text-bronze-ink" aria-hidden /> הוספה לאוסף השראה
          </button>
          <Link className={item} href={`/b/${reel.business.slug}`}>
            <Store className="size-5 text-bronze-ink" aria-hidden /> לפרופיל של {reel.business.name}
          </Link>
          <button className={item} onClick={() => requireAuth("התחברו כדי לדווח על תוכן.") && setMode("report")}>
            <Flag className="size-5 text-bad" aria-hidden /> דיווח על הסרטון
          </button>
          <button className={item} onClick={hide}>
            <EyeOff className="size-5 text-muted" aria-hidden /> לא להציג לי את העסק הזה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted">מה הבעיה בתוכן?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex h-12 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper px-4 has-[:checked]:border-ink">
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--color-ink)]" />
                {r}
              </label>
            ))}
          </fieldset>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="פרטים נוספים (לא חובה)" aria-label="פרטים נוספים" maxLength={1000} />
          <Button onClick={report} loading={busy} size="lg">
            שליחת דיווח
          </Button>
        </div>
      )}
    </Sheet>
  );
}
