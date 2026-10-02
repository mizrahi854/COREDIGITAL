import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Search } from "lucide-react";
import { price, STATUS_LABEL } from "../../domain/format";
import { fmtShortDate, fmtTime } from "../../domain/time";
import { Avatar, Badge, EmptyState, Input, LinkButton } from "../../ui/kit";
import { Page, TopBar } from "../../ui/shell";
import { StatusBadge } from "../appointments";
import { customerName, useBiz } from "./common";

export function CustomersScreen() {
  const { db, appointments } = useBiz();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; registered: boolean; visits: number; noShows: number; spent: number; last: string }>();
    for (const a of appointments) {
      const key = a.customerId ?? `guest:${a.guestName}:${a.guestPhone ?? ""}`;
      const r = map.get(key) ?? { id: a.customerId ?? key, name: customerName(db, a), registered: !!a.customerId, visits: 0, noShows: 0, spent: 0, last: a.start };
      if (a.status === "completed") {
        r.visits++;
        r.spent += a.snapshot.price;
      }
      if (a.status === "no_show") r.noShows++;
      if (a.start > r.last) r.last = a.start;
      map.set(key, r);
    }
    return [...map.values()].sort((x, y) => y.last.localeCompare(x.last));
  }, [db, appointments]);
  const list = rows.filter((r) => r.name.includes(q.trim()));
  return (
    <>
      <TopBar title="לקוחות" back="/manage" />
      <Page className="max-w-3xl">
        <div className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" className="ps-12" placeholder="חיפוש לפי שם" aria-label="חיפוש לקוחות" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {list.length === 0 && <EmptyState title="לא נמצאו לקוחות" />}
          {list.map((r) => {
            const body = (
              <>
                <Avatar name={r.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {r.name} {!r.registered && <Badge tone="outline">ללא חשבון</Badge>}
                  </div>
                  <div className="num text-sm text-muted">
                    {r.visits} ביקורים · {price(r.spent)}
                    {r.noShows > 0 && ` · ${r.noShows} אי־הגעות`}
                  </div>
                </div>
                <span className="num text-xs text-muted">{fmtShortDate(r.last)}</span>
              </>
            );
            return <li key={r.id}>{r.registered ? <Link to={`/manage/customers/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-surface">{body}</Link> : <div className="flex items-center gap-3 rounded-2xl border border-line p-3">{body}</div>}</li>;
          })}
        </ul>
      </Page>
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { db, appointments, business: b } = useBiz();
  const u = db.users.find((x) => x.id === id);
  const appts = appointments.filter((a) => a.customerId === id).sort((x, y) => y.start.localeCompare(x.start));
  if (!u || !appts.length)
    return (
      <>
        <TopBar title="לקוח/ה" back="/manage/customers" />
        <Page>
          <EmptyState title="הלקוח/ה לא נמצא/ה" text="מוצגים רק לקוחות שקבעו תור בעסק." action={<LinkButton to="/manage/customers">ללקוחות</LinkButton>} />
        </Page>
      </>
    );
  const conv = db.conversations.find((c) => c.customerId === u.id && c.businessId === b.id);
  const reviews = db.reviews.filter((r) => r.customerId === u.id && r.businessId === b.id);
  const completed = appts.filter((a) => a.status === "completed");
  return (
    <>
      <TopBar title={u.name} back="/manage/customers" />
      <Page className="max-w-3xl">
        <div className="flex items-center gap-4">
          <Avatar name={u.name} size={64} />
          <div className="flex-1">
            <h1 className="text-xl font-black">{u.name}</h1>
            <p className="text-sm text-muted">{db.cities.find((c) => c.id === u.cityId)?.name}</p>
          </div>
          {conv && (
            <LinkButton to={`/messages/${conv.id}`} variant="secondary" size="sm">
              לשיחה
            </LinkButton>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface p-3">
            <div className="num text-xl font-black">{completed.length}</div>
            <div className="text-xs text-muted">ביקורים</div>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <div className="num text-xl font-black">{price(completed.reduce((s, a) => s + a.snapshot.price, 0))}</div>
            <div className="text-xs text-muted">סה״כ</div>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <div className="num text-xl font-black">{appts.filter((a) => a.status === "no_show").length}</div>
            <div className="text-xs text-muted">אי־הגעות</div>
          </div>
        </div>
        <h2 className="mb-2 mt-6 font-bold">תורים</h2>
        <ul className="flex flex-col gap-2">
          {appts.map((a) => (
            <li key={a.id}>
              <Link to={`/manage/appointments/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-surface">
                <span className="num w-20 text-sm">
                  {fmtShortDate(a.start)} {fmtTime(a.start)}
                </span>
                <span className="flex-1 truncate">{a.snapshot.serviceName}</span>
                <StatusBadge a={a} />
              </Link>
            </li>
          ))}
        </ul>
        {reviews.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-bold">ביקורות</h2>
            {reviews.map((r) => (
              <p key={r.id} className="rounded-2xl bg-surface p-3 text-sm">
                {"★".repeat(r.rating)} {r.text}
              </p>
            ))}
          </>
        )}
        <p className="mt-6 text-xs text-muted">סטטוסים: {Object.values(STATUS_LABEL).join(" · ")}</p>
      </Page>
    </>
  );
}
