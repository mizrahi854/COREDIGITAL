import { useState } from "react";
import { Link } from "react-router";
import { Eye, EyeOff, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import type { Post } from "../../domain/types";
import { compact } from "../../domain/format";
import { fmtRelative } from "../../domain/time";
import { deletePost, setPostPublished, togglePin } from "../../store/actions";
import { toast } from "../../store/app";
import { useMediaUrl } from "../../ui/hooks";
import { Badge, Chip, EmptyState, IconButton, LinkButton } from "../../ui/kit";
import { ConfirmDialog } from "../../ui/overlays";
import { Page, TopBar } from "../../ui/shell";
import { useBiz } from "./common";

export function ContentScreen() {
  const { db, business: b } = useBiz();
  const [f, setF] = useState<"all" | "published" | "draft" | "hidden">("all");
  const [del, setDel] = useState<Post | null>(null);
  const posts = db.posts.filter((p) => p.businessId === b.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const list = posts.filter((p) => f === "all" || p.status === f);
  const label = { all: "הכול", published: "מפורסם", draft: "טיוטות", hidden: "מוסתר" } as const;
  return (
    <>
      <TopBar title="תוכן" back="/manage" actions={<LinkButton to="/create" size="sm"><Plus className="size-4" aria-hidden /> חדש</LinkButton>} />
      <Page className="max-w-3xl">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {(Object.keys(label) as (keyof typeof label)[]).map((k) => (
            <Chip key={k} active={f === k} onClick={() => setF(k)}>
              {label[k]} <span className="num opacity-70">{k === "all" ? posts.length : posts.filter((p) => p.status === k).length}</span>
            </Chip>
          ))}
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {list.length === 0 && <EmptyState title="אין כאן תוכן" action={<LinkButton to="/create">יצירת פוסט</LinkButton>} />}
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line p-2.5">
              <Thumb post={p} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={p.status === "published" ? "ok" : p.status === "hidden" ? "bad" : "outline"}>{p.status === "published" ? "מפורסם" : p.status === "hidden" ? "הוסתר ע״י Beautigo" : "טיוטה"}</Badge>
                  <Badge>{p.kind === "reel" ? "רילס" : p.kind === "carousel" ? "קרוסלה" : "תמונה"}</Badge>
                  {b.pinnedPostIds.includes(p.id) && <Badge tone="dark">נעוץ</Badge>}
                  {p.isSample && <Badge tone="outline">לדוגמה</Badge>}
                </div>
                <p className="mt-1 truncate text-sm">{p.caption || "ללא כיתוב"}</p>
                <p className="num text-xs text-muted">
                  {compact(p.views)} צפיות · {p.likedBy.length} לייקים · {p.savedCount} שמירות · {fmtRelative(p.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0">
                {p.status === "published" && (
                  <IconButton label={b.pinnedPostIds.includes(p.id) ? "ביטול נעיצה" : "נעיצה"} onClick={() => togglePin(p.id) !== undefined && toast("ok", "עודכן")}>
                    <Pin className="size-4" />
                  </IconButton>
                )}
                {p.status !== "hidden" && (
                  <IconButton label={p.status === "published" ? "הסתרה (העברה לטיוטה)" : "פרסום"} onClick={() => setPostPublished(p.id, p.status !== "published") !== undefined && toast("ok", p.status === "published" ? "הוסר מהפרסום" : "פורסם")}>
                    {p.status === "published" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </IconButton>
                )}
                <Link to={`/create?edit=${p.id}`} className="grid size-11 place-items-center rounded-full hover:bg-surface" aria-label="עריכה">
                  <Pencil className="size-4" />
                </Link>
                <IconButton label="מחיקה" onClick={() => setDel(p)}>
                  <Trash2 className="size-4 text-bad" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      </Page>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="למחוק את הפוסט?" body="הפעולה לא ניתנת לביטול." confirmLabel="מחיקה" danger onConfirm={() => del && deletePost(del.id) && toast("ok", "נמחק")} />
    </>
  );
}

function Thumb({ post }: { post: Post }) {
  const url = useMediaUrl(post.cover ?? post.media[0]?.poster ?? post.media[0]?.src);
  return (
    <Link to={`/post/${post.id}`} className="block h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-surface" aria-label="תצוגה">
      {url && <img src={url} alt="" className="media size-full object-cover" />}
    </Link>
  );
}
