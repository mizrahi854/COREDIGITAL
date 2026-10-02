import { useState } from "react";
import { DateTime } from "luxon";
import { Megaphone, Pause, Play } from "lucide-react";
import { compact, price } from "../../domain/format";
import { TZ, fmtShortDate } from "../../domain/time";
import { setCampaignStatus, upsertCampaign } from "../../store/actions";
import { toast } from "../../store/app";
import { Badge, Button, DemoLabel, EmptyState, Field, Input, Select } from "../../ui/kit";
import { Sheet } from "../../ui/overlays";
import { Page, TopBar } from "../../ui/shell";
import { useBiz } from "./common";

/** Promotion is a later-phase concept: no real billing, metrics are simulated. */
export function PromoteScreen() {
  const { db, business: b } = useBiz();
  const [open, setOpen] = useState(false);
  const campaigns = db.campaigns.filter((c) => c.businessId === b.id);
  return (
    <>
      <TopBar
        title="קידום"
        back="/manage"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Megaphone className="size-4" aria-hidden /> קמפיין
          </Button>
        }
      />
      <Page className="max-w-2xl">
        <div className="mb-4 rounded-2xl bg-surface p-4 text-sm">
          <DemoLabel>קונספט לשלב מאוחר · ללא חיוב אמיתי</DemoLabel>
          <p className="mt-2 leading-relaxed">תוכן מקודם מופיע בפיד ״בשבילך״ בערים שנבחרו, תמיד עם תווית ״ממומן״, ורק אם הוא עומד בסינון של הצופה (עיר, חסימות). הקידום מוסיף ניקוד אך לא עוקף סינון. המדדים כאן מדומים.</p>
        </div>
        {campaigns.length === 0 ? (
          <EmptyState icon={<Megaphone className="size-6" aria-hidden />} title="אין קמפיינים" action={<Button onClick={() => setOpen(true)}>יצירת קמפיין</Button>} />
        ) : (
          <ul className="flex flex-col gap-3">
            {campaigns.map((c) => {
              const p = db.posts.find((x) => x.id === c.postId);
              const ctr = c.metrics.impressions ? (c.metrics.clicks / c.metrics.impressions) * 100 : 0;
              return (
                <li key={c.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p?.caption.slice(0, 50) ?? "פוסט שהוסר"}</div>
                      <div className="num text-sm text-muted">
                        {c.cityIds.map((id) => db.cities.find((x) => x.id === id)?.name).join(", ")} · {fmtShortDate(c.start)}–{fmtShortDate(c.end)} · תקציב {price(c.budget)}
                      </div>
                    </div>
                    <Badge tone={c.status === "active" ? "ok" : "outline"}>{c.status === "active" ? "פעיל" : c.status === "paused" ? "מושהה" : "הסתיים"}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                    {[
                      ["חשיפות", compact(c.metrics.impressions)],
                      ["קליקים", compact(c.metrics.clicks)],
                      ["CTR", `${ctr.toFixed(1)}%`],
                      ["הזמנות", c.metrics.bookings],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-surface p-2">
                        <dd className="num font-bold">{v}</dd>
                        <dt className="text-xs text-muted">{k}</dt>
                      </div>
                    ))}
                  </dl>
                  {c.status !== "ended" && (
                    <Button size="sm" variant="secondary" className="mt-3" onClick={() => setCampaignStatus(c.id, c.status === "active" ? "paused" : "active") !== undefined && toast("ok", "עודכן")}>
                      {c.status === "active" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />} {c.status === "active" ? "השהיה" : "הפעלה"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Page>
      <NewCampaign open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function NewCampaign({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, business: b } = useBiz();
  const posts = db.posts.filter((p) => p.businessId === b.id && p.status === "published");
  const today = DateTime.now().setZone(TZ);
  const [postId, setPostId] = useState(posts[0]?.id ?? "");
  const [cities, setCities] = useState<string[]>([b.cityId]);
  const [budget, setBudget] = useState(300);
  const [days, setDays] = useState(7);
  return (
    <Sheet open={open} onClose={onClose} title="קמפיין חדש (דמו)">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (upsertCampaign({ postId, cityIds: cities, budget, start: today.toISO()!, end: today.plus({ days }).toISO()! })) {
            toast("ok", "הקמפיין נוצר (דמו — ללא חיוב)");
            onClose();
          }
        }}
      >
        <Field label="תוכן לקידום" htmlFor="cp-post">
          <Select id="cp-post" value={postId} onChange={(e) => setPostId(e.target.value)}>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.caption.slice(0, 50)}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">ערים</legend>
          <div className="flex flex-wrap gap-2">
            {db.cities
              .filter((c) => c.active)
              .map((c) => (
                <label key={c.id} className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-surface">
                  <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={cities.includes(c.id)} onChange={() => setCities(cities.includes(c.id) ? cities.filter((x) => x !== c.id) : [...cities, c.id])} />
                  {c.name}
                </label>
              ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תקציב (₪, דמו)" htmlFor="cp-b">
            <Input id="cp-b" type="number" min={50} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </Field>
          <Field label="משך (ימים)" htmlFor="cp-d">
            <Input id="cp-d" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </Field>
        </div>
        <p className="text-xs text-muted">לא יתבצע חיוב. בגרסה אמיתית: תשלום מראש, תקרת תקציב יומית ודוחות.</p>
        <Button type="submit" size="lg" disabled={!postId}>
          יצירה
        </Button>
      </form>
    </Sheet>
  );
}
