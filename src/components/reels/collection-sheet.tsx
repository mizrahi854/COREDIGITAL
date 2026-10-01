"use client";

import { useEffect, useState } from "react";
import { Check, FolderPlus, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Sheet } from "../sheet";
import { Button, Input } from "../ui";
import { useToast } from "../toast";

type Col = { id: string; name: string; reelIds: string[] };

/** Organize a saved reel into collections ("השראה לחתונה", "ציפורניים לקיץ"...). */
export function CollectionSheet({ open, onClose, reelId }: { open: boolean; onClose: () => void; reelId: string }) {
  const [cols, setCols] = useState<Col[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setError(null);
    apiFetch<{ collections: Col[] }>("/api/collections")
      .then((r) => setCols(r.collections))
      .catch((e) => setError(e.message));
  }, [open]);

  const toggle = async (c: Col) => {
    const on = !c.reelIds.includes(reelId);
    setBusy(c.id);
    try {
      await apiFetch(`/api/collections/${c.id}/items`, { body: { reelId, on } });
      setCols((all) => all?.map((x) => (x.id === c.id ? { ...x, reelIds: on ? [...x.reelIds, reelId] : x.reelIds.filter((r) => r !== reelId) } : x)) ?? null);
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("new");
    try {
      const c = await apiFetch<{ id: string; name: string }>("/api/collections", { body: { name, reelId } });
      setCols((all) => [{ id: c.id, name: c.name, reelIds: [reelId] }, ...(all ?? [])]);
      setName("");
      toast({ kind: "ok", text: `נוסף לאוסף "${c.name}"` });
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="הוספה לאוסף">
      <form onSubmit={create} className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="אוסף חדש, למשל: השראה לחתונה" aria-label="שם אוסף חדש" maxLength={40} />
        <Button type="submit" loading={busy === "new"} disabled={!name.trim()} className="shrink-0">
          <FolderPlus className="size-4" aria-hidden /> יצירה
        </Button>
      </form>
      {error && <p className="text-sm text-bad">{error}</p>}
      {!cols && !error && <Loader2 className="mx-auto size-6 animate-spin text-muted" aria-label="טוען" />}
      {cols?.length === 0 && <p className="py-4 text-center text-sm text-muted">עוד אין אוספים. צרו את הראשון למעלה.</p>}
      <ul className="flex flex-col gap-2">
        {cols?.map((c) => {
          const on = c.reelIds.includes(reelId);
          return (
            <li key={c.id}>
              <button
                onClick={() => toggle(c)}
                aria-pressed={on}
                className="flex h-14 w-full items-center justify-between rounded-2xl border border-line bg-paper px-4 text-start transition hover:bg-sand"
              >
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {c.reelIds.length} פריטים
                  {busy === c.id ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <span className={on ? "grid size-6 place-items-center rounded-full bg-ink text-cream" : "size-6 rounded-full border-2 border-line"}>
                      {on && <Check className="size-4" />}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
