"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, CalendarPlus, FolderPlus, MoreVertical, Pencil, Store, Trash2 } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { Avatar, Button, ButtonLink, Chip, EmptyState, Input } from "./ui";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { CollectionSheet } from "./reels/collection-sheet";

type Reel = { id: string; thumbUrl: string | null; caption: string; isSample: boolean; businessName: string; bookHref: string };
type Biz = { id: string; slug: string; name: string; city: string; avatarUrl: string | null; tagline: string | null };
type Col = { id: string; name: string; reelIds: string[] };

export function SavedView({ reels, businesses, collections }: { reels: Reel[]; businesses: Biz[]; collections: Col[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"reels" | "businesses">("reels");
  const [col, setCol] = useState<string | null>(null);
  const [manage, setManage] = useState<Reel | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [colSheet, setColSheet] = useState<"new" | Col | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const active = collections.find((c) => c.id === col);
  const visible = active ? reels.filter((r) => active.reelIds.includes(r.id)) : reels;

  const unsave = async (r: Reel) => {
    try {
      await apiFetch("/api/social", { body: { action: "save", targetId: r.id, on: false } });
      toast({ kind: "ok", text: "הוסר מהשמורים" });
      setManage(null);
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    }
  };
  const unsaveBiz = async (b: Biz) => {
    try {
      await apiFetch("/api/social", { body: { action: "saveBusiness", targetId: b.id, on: false } });
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    }
  };
  const saveCollection = async () => {
    setBusy(true);
    try {
      if (colSheet === "new") await apiFetch("/api/collections", { body: { name } });
      else if (colSheet) await apiFetch(`/api/collections/${colSheet.id}`, { method: "PATCH", body: { name } });
      setColSheet(null);
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const deleteCollection = async (c: Col) => {
    if (!confirm(`למחוק את האוסף "${c.name}"? הסרטונים יישארו בשמורים.`)) return;
    await apiFetch(`/api/collections/${c.id}`, { method: "DELETE" }).catch((e) => toast({ kind: "error", text: e.message }));
    setCol(null);
    setColSheet(null);
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:pt-10">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">שמורים</h1>
      <div className="mb-5 flex gap-2" role="tablist">
        <Chip role="tab" aria-selected={tab === "reels"} active={tab === "reels"} onClick={() => setTab("reels")}>
          השראות ({reels.length})
        </Chip>
        <Chip role="tab" aria-selected={tab === "businesses"} active={tab === "businesses"} onClick={() => setTab("businesses")}>
          עסקים ({businesses.length})
        </Chip>
      </div>

      {tab === "reels" && (
        <>
          <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            <button onClick={() => setCol(null)} className={clsx("h-9 shrink-0 rounded-full px-3.5 text-sm font-medium", !col ? "bg-sand-2" : "hover:bg-sand")}>
              הכול
            </button>
            {collections.map((c) => (
              <button key={c.id} onClick={() => setCol(c.id)} className={clsx("h-9 shrink-0 rounded-full px-3.5 text-sm font-medium", col === c.id ? "bg-sand-2" : "hover:bg-sand")}>
                {c.name} <span className="text-muted">{c.reelIds.length}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setName("");
                setColSheet("new");
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 text-sm font-medium text-bronze-ink hover:bg-sand"
            >
              <FolderPlus className="size-4" aria-hidden /> אוסף חדש
            </button>
            {active && (
              <button
                onClick={() => {
                  setName(active.name);
                  setColSheet(active);
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-muted hover:bg-sand"
              >
                <Pencil className="size-3.5" aria-hidden /> עריכה
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon={<Bookmark className="size-6" />}
              title={active ? "האוסף ריק" : "עוד לא שמרת השראות"}
              text={active ? "הוסיפו לאוסף סרטונים מהשמורים או ישר מהפיד." : "לחצו על סימן השמירה בסרטון כדי לאסוף עבודות שאהבתם ולצרף אותן לתור."}
              action={<ButtonLink href="/">לפיד</ButtonLink>}
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((r) => (
                <li key={r.id} className="group relative overflow-hidden rounded-[1.25rem] bg-sand">
                  <Link href={`/reel/${r.id}`} className="block aspect-[9/14]" aria-label={r.caption || "סרטון שמור"}>
                    {r.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                  </Link>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-cream">
                    <div className="truncate text-sm font-semibold">{r.businessName}</div>
                    <div className="truncate text-xs text-cream/80">{r.caption}</div>
                  </div>
                  <button onClick={() => setManage(r)} className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur" aria-label="אפשרויות">
                    <MoreVertical className="size-4" />
                  </button>
                  {r.isSample && <span className="absolute start-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white">לדוגמה</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "businesses" &&
        (businesses.length === 0 ? (
          <EmptyState icon={<Store className="size-6" />} title="אין עסקים שמורים" text="שמרו עסקים מהפרופיל שלהם כדי לחזור אליהם מהר." action={<ButtonLink href="/search">לחיפוש עסקים</ButtonLink>} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {businesses.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-paper p-4 shadow-[var(--shadow-soft)]">
                <Avatar src={b.avatarUrl} name={b.name} size={52} />
                <Link href={`/b/${b.slug}`} className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{b.name}</div>
                  <div className="truncate text-sm text-muted">{b.tagline ?? b.city}</div>
                </Link>
                <ButtonLink href={`/b/${b.slug}/book`} size="sm" variant="secondary">
                  קביעה
                </ButtonLink>
                <button onClick={() => unsaveBiz(b)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-sand" aria-label={`הסרת ${b.name} מהשמורים`}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ))}

      <Sheet open={!!manage} onClose={() => setManage(null)} title="השראה שמורה">
        {manage && (
          <div className="flex flex-col gap-2">
            <ButtonLink href={manage.bookHref} size="lg">
              <CalendarPlus className="size-4" aria-hidden /> קביעת תור עם ההשראה הזו
            </ButtonLink>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setAddTo(manage.id);
                setManage(null);
              }}
            >
              <FolderPlus className="size-4" aria-hidden /> הוספה / הסרה מאוסף
            </Button>
            <Button variant="danger" size="lg" onClick={() => unsave(manage)}>
              <Trash2 className="size-4" aria-hidden /> הסרה מהשמורים
            </Button>
          </div>
        )}
      </Sheet>
      {addTo && (
        <CollectionSheet
          open
          reelId={addTo}
          onClose={() => {
            setAddTo(null);
            router.refresh();
          }}
        />
      )}
      <Sheet open={!!colSheet} onClose={() => setColSheet(null)} title={colSheet === "new" ? "אוסף חדש" : "עריכת אוסף"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveCollection();
          }}
          className="flex flex-col gap-3"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם האוסף" aria-label="שם האוסף" maxLength={40} autoFocus />
          <Button type="submit" size="lg" disabled={!name.trim()} loading={busy}>
            שמירה
          </Button>
          {colSheet && colSheet !== "new" && (
            <Button type="button" variant="danger" onClick={() => deleteCollection(colSheet)}>
              מחיקת האוסף
            </Button>
          )}
        </form>
      </Sheet>
    </main>
  );
}
