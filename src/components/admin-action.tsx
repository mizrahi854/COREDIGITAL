"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { Button } from "./ui";
import { useToast } from "./toast";

/** Admin action button; every action is recorded server-side in the admin log. */
export function AdminAction({
  kind,
  id,
  action,
  label,
  variant = "secondary",
  askNote,
}: {
  kind: "business" | "reel" | "report" | "appointment";
  id: string;
  action: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  askNote?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    let note = "";
    if (askNote) {
      const v = prompt(askNote);
      if (v === null) return;
      note = v;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/${kind}/${id}`, { body: { action, note } });
      toast({ kind: "ok", text: "בוצע ונרשם ביומן הפעולות" });
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant={variant} loading={busy} onClick={run}>
      {label}
    </Button>
  );
}
