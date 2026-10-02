import { useMemo } from "react";
import { useParams } from "react-router";
import { visibleTo } from "../domain/feed";
import { useApp, useMe } from "../store/app";
import { EmptyState, LinkButton } from "../ui/kit";
import { TopBar } from "../ui/shell";
import { FeedList, usePostItems } from "./feed";

/** A shared or tapped post opens full screen; more work from the same business follows below. */
export function PostScreen() {
  const { postId } = useParams();
  const db = useApp((s) => s.db);
  const me = useMe();
  const post = db.posts.find((p) => p.id === postId);
  const isOwner = !!post && me?.role === "business" && me.businessId === post.businessId;
  const list = useMemo(() => {
    if (!post) return [];
    const rest = db.posts.filter((p) => p.businessId === post.businessId && p.id !== post.id && visibleTo(db, p, me));
    return [post, ...rest];
  }, [db, post, me]);
  const items = usePostItems(list);
  if (!post || (!visibleTo(db, post, me) && !isOwner))
    return (
      <>
        <TopBar title="הפוסט לא זמין" back />
        <div className="p-4">
          <EmptyState title="התוכן לא זמין" text="ייתכן שהוסר, הוסתר בעקבות דיווח, או שהעסק אינו פעיל כרגע." action={<LinkButton to="/">לפיד</LinkButton>} />
        </div>
      </>
    );
  return (
    <div className="on-media relative h-[100dvh] bg-black text-white">
      <div className="absolute start-0 top-0 z-30 p-2">
        <div className="safe-top" />
        <button type="button" onClick={() => history.back()} className="glass-dark grid size-11 place-items-center rounded-full" aria-label="חזרה">
          <span aria-hidden className="text-2xl leading-none">›</span>
        </button>
      </div>
      <FeedList items={items} tabKey={`post-${post.id}`} />
    </div>
  );
}
