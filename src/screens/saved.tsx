import { useState } from "react";
import { Bookmark, MoreHorizontal } from "lucide-react";
import clsx from "clsx";
import { deleteCollection, renameCollection } from "../store/actions";
import { toast, useApp, useMe } from "../store/app";
import { visibleTo } from "../domain/feed";
import { Button, Chip, EmptyState, IconButton, Input, LinkButton } from "../ui/kit";
import { ConfirmDialog, Sheet } from "../ui/overlays";
import { Page, TopBar } from "../ui/shell";
import { PostTile } from "./discover";

export function SavedScreen() {
  const db = useApp((s) => s.db);
  const me = useMe();
  const [active, setActive] = useState<string | "all">("all");
  const [manage, setManage] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!me)
    return (
      <>
        <TopBar title="שמורים" large />
        <Page>
          <EmptyState icon={<Bookmark className="size-6" aria-hidden />} title="שמרו השראה לאוספים" text="התחברו כדי לשמור עבודות שאהבתם ולחזור אליהן כשקובעים תור." action={<LinkButton to="/signin?next=/saved">התחברות</LinkButton>} />
        </Page>
      </>
    );
  const cols = db.collections.filter((c) => c.userId === me.id);
  const col = cols.find((c) => c.id === active);
  const ids = col ? col.postIds : [...new Set(cols.flatMap((c) => c.postIds))];
  const posts = ids.map((id) => db.posts.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const visible = posts.filter((p) => visibleTo(db, p, me));
  const unavailable = posts.length - visible.length;
  return (
    <>
      <TopBar
        title="שמורים"
        large
        sub={me.privacy.privateSaves ? "השמורים שלך פרטיים" : undefined}
        actions={
          col ? (
            <IconButton label="ניהול האוסף" onClick={() => (setName(col.name), setManage(true))}>
              <MoreHorizontal className="size-5" />
            </IconButton>
          ) : undefined
        }
      />
      <Page>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={active === "all"} onClick={() => setActive("all")}>
            הכול <span className="num opacity-70">{new Set(cols.flatMap((c) => c.postIds)).size}</span>
          </Chip>
          {cols.map((c) => (
            <Chip key={c.id} active={active === c.id} onClick={() => setActive(c.id)}>
              {c.name} <span className="num opacity-70">{c.postIds.length}</span>
            </Chip>
          ))}
        </div>
        <div className={clsx("mt-4")}>
          {visible.length === 0 ? (
            <EmptyState icon={<Bookmark className="size-6" aria-hidden />} title="האוסף ריק" text="לחצו על סימן השמירה בכל פוסט כדי להוסיף לכאן. אפשר ליצור אוספים כמו ״חתונה״ או ״שיער לקיץ״." action={<LinkButton to="/">לפיד</LinkButton>} />
          ) : (
            <ul className="grid grid-cols-3 gap-1 md:grid-cols-4 md:gap-2">
              {visible.map((p) => (
                <li key={p.id}>
                  <PostTile post={p} />
                </li>
              ))}
            </ul>
          )}
          {unavailable > 0 && <p className="mt-3 text-xs text-muted">{unavailable} פריטים שמורים כבר לא זמינים (הוסרו, הוסתרו או שהעסק נחסם).</p>}
        </div>
      </Page>
      {col && (
        <Sheet open={manage} onClose={() => setManage(false)} title="ניהול אוסף">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (renameCollection(col.id, name) !== undefined) {
                toast("ok", "שם האוסף עודכן");
                setManage(false);
              }
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="שם האוסף" maxLength={40} />
            <Button type="submit" disabled={!name.trim()}>
              שמירה
            </Button>
          </form>
          <Button variant="danger" className="mt-4 w-full" onClick={() => setConfirmDelete(true)}>
            מחיקת האוסף
          </Button>
        </Sheet>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="למחוק את האוסף?"
        body="הפוסטים עצמם לא יימחקו — רק האוסף."
        confirmLabel="מחיקה"
        danger
        onConfirm={() => {
          if (col && deleteCollection(col.id) !== undefined) {
            setManage(false);
            setActive("all");
            toast("ok", "האוסף נמחק");
          }
        }}
      />
    </>
  );
}
