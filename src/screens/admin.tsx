import { useState, type ReactNode } from "react";
import { Link, NavLink, useParams } from "react-router";
import clsx from "clsx";
import type { DB, Report } from "../domain/types";
import { CATEGORIES, compact, price, STATUS_LABEL } from "../domain/format";
import { fmtDateTime, fmtRelative, fmtShortDate } from "../domain/time";
import {
  adminCancelAppointment,
  adminResolveIntegration,
  adminResolveReport,
  adminSetBusinessStatus,
  adminSetCityActive,
  adminSetCommentHidden,
  adminSetPostHidden,
  adminSetReviewHidden,
  adminSetUserStatus,
  setCampaignStatus,
} from "../store/actions";
import { toast, useApp } from "../store/app";
import { Avatar, Badge, Button, DemoLabel, EmptyState, Input } from "../ui/kit";
import { ConfirmDialog } from "../ui/overlays";
import { TopBar } from "../ui/shell";
import { StatCard } from "./manage/common";
import { StatusBadge } from "./appointments";

const SECTIONS = [
  ["", "סקירה"],
  ["reports", "דיווחים"],
  ["businesses", "עסקים"],
  ["users", "משתמשים"],
  ["moderation", "מודרציה"],
  ["appointments", "תמיכה בתורים"],
  ["cities", "ערים וקטגוריות"],
  ["campaigns", "קמפיינים"],
  ["payments", "תשלומים (דמו)"],
  ["integrations", "תקלות אינטגרציה"],
  ["roles", "הרשאות"],
  ["audit", "יומן פעולות"],
] as const;

type Pending = { title: string; body?: string; label: string; danger?: boolean; run: (reason: string) => unknown };

export function AdminScreen() {
  const section = useParams()["*"] ?? "";
  const db = useApp((s) => s.db);
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = (p: Pending) => setPending(p);
  const openReports = db.reports.filter((r) => r.status === "open").length;
  return (
    <>
      <TopBar title="ניהול מערכת" sub="פעולות רגישות דורשות סיבה ונרשמות ביומן" large />
      <div className="mx-auto max-w-6xl px-4 pb-10 lg:px-6">
        <nav aria-label="אזורי ניהול" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
          {SECTIONS.map(([to, label]) => (
            <NavLink key={to} to={`/admin${to ? `/${to}` : ""}`} end className={({ isActive }) => clsx("flex h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold", isActive ? "border-ink" : "border-transparent text-muted hover:text-ink")}>
              {label}
              {to === "reports" && openReports > 0 && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] text-white">{openReports}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="pt-5">
          {section === "" && <Overview db={db} />}
          {section === "reports" && <Reports db={db} ask={ask} />}
          {section === "businesses" && <Businesses db={db} ask={ask} />}
          {section === "users" && <Users db={db} ask={ask} />}
          {section === "moderation" && <Moderation db={db} ask={ask} />}
          {section === "appointments" && <AppointmentSupport db={db} ask={ask} />}
          {section === "cities" && <Cities db={db} ask={ask} />}
          {section === "campaigns" && <Campaigns db={db} />}
          {section === "payments" && <Payments db={db} />}
          {section === "integrations" && <Integrations db={db} ask={ask} />}
          {section === "roles" && <Roles />}
          {section === "audit" && <Audit db={db} />}
          {!SECTIONS.some(([s]) => s === section) && <EmptyState title="אזור לא קיים" action={<Link to="/admin" className="underline">לסקירה</Link>} />}
        </div>
      </div>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.title ?? ""}
        body={pending?.body}
        confirmLabel={pending?.label ?? "אישור"}
        danger={pending?.danger}
        reason="required"
        onConfirm={(r) => {
          if (pending?.run(r) !== undefined) toast("ok", "בוצע ונרשם ביומן הפעולות");
        }}
      />
    </>
  );
}

type Ask = (p: Pending) => void;

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface text-xs text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-3 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function Overview({ db }: { db: DB }) {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const appts = db.appointments.filter((a) => Date.parse(a.createdAt) >= weekAgo);
  const gmv = db.appointments.filter((a) => a.status === "completed").reduce((s, a) => s + a.snapshot.price, 0);
  return (
    <>
      <DemoLabel className="mb-3">מדדים מחושבים מנתוני הדמו בדפדפן — לא נתונים אמיתיים</DemoLabel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="עסקים פעילים" value={db.businesses.filter((b) => b.status === "active").length} hint={`${db.businesses.filter((b) => b.status === "pending").length} ממתינים לאישור`} />
        <StatCard label="משתמשים" value={db.users.length} hint={`${db.users.filter((u) => u.status === "suspended").length} מושעים`} />
        <StatCard label="הזמנות (7 ימים)" value={appts.length} />
        <StatCard label="היקף תורים שהושלמו" value={price(gmv)} />
        <StatCard label="פוסטים מפורסמים" value={db.posts.filter((p) => p.status === "published").length} />
        <StatCard label="צפיות מצטברות" value={compact(db.posts.reduce((s, p) => s + p.views, 0))} />
        <StatCard label="דיווחים פתוחים" value={db.reports.filter((r) => r.status === "open").length} />
        <StatCard label="תקלות אינטגרציה" value={db.integrationEvents.filter((e) => !e.resolved && e.level === "error").length} />
      </div>
      <h2 className="mb-2 mt-6 font-bold">פעולות אחרונות</h2>
      <Audit db={db} limit={5} />
    </>
  );
}

function targetLabel(db: DB, r: Report) {
  if (r.targetType === "post") return { text: db.posts.find((p) => p.id === r.targetId)?.caption.slice(0, 50) ?? "פוסט שנמחק", link: `/post/${r.targetId}` };
  if (r.targetType === "comment") return { text: `״${db.comments.find((c) => c.id === r.targetId)?.text ?? "תגובה"}״` };
  if (r.targetType === "review") return { text: `ביקורת: ״${db.reviews.find((x) => x.id === r.targetId)?.text.slice(0, 50) ?? ""}״` };
  if (r.targetType === "business") return { text: db.businesses.find((b) => b.id === r.targetId)?.name ?? "עסק", link: `/b/${r.targetId}` };
  if (r.targetType === "user") return { text: db.users.find((u) => u.id === r.targetId)?.name ?? "משתמש" };
  return { text: "שיחה" };
}

function Reports({ db, ask }: { db: DB; ask: Ask }) {
  const [f, setF] = useState<"open" | "closed">("open");
  const list = db.reports.filter((r) => (f === "open" ? r.status === "open" : r.status !== "open"));
  return (
    <>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={f === "open" ? "primary" : "secondary"} onClick={() => setF("open")}>
          פתוחים
        </Button>
        <Button size="sm" variant={f === "closed" ? "primary" : "secondary"} onClick={() => setF("closed")}>
          טופלו
        </Button>
      </div>
      {list.length === 0 && <EmptyState title="אין דיווחים" />}
      <ul className="flex flex-col gap-3">
        {list.map((r) => {
          const t = targetLabel(db, r);
          const reporter = db.users.find((u) => u.id === r.reporterId);
          const hideable = r.targetType === "post" || r.targetType === "comment" || r.targetType === "review";
          const isHidden =
            (r.targetType === "post" && db.posts.find((p) => p.id === r.targetId)?.status === "hidden") ||
            (r.targetType === "comment" && db.comments.find((c) => c.id === r.targetId)?.hidden) ||
            (r.targetType === "review" && db.reviews.find((x) => x.id === r.targetId)?.hidden);
          return (
            <li key={r.id} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="bad">{r.reason}</Badge>
                <Badge tone="outline">{{ post: "פוסט", comment: "תגובה", review: "ביקורת", business: "עסק", user: "משתמש", conversation: "שיחה" }[r.targetType]}</Badge>
                {isHidden && <Badge>הוסתר</Badge>}
                <span className="ms-auto text-xs text-muted">
                  {reporter?.name} · {fmtRelative(r.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm">{t.link ? <Link to={t.link} className="underline">{t.text}</Link> : t.text}</p>
              {r.details && <p className="mt-1 text-sm text-muted">{r.details}</p>}
              {r.status !== "open" ? (
                <p className="mt-2 text-sm text-muted">
                  {r.status === "resolved" ? "טופל" : "נדחה"}: {r.resolution}
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {hideable && !isHidden && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        ask({
                          title: "להסתיר את התוכן ולסגור את הדיווח?",
                          label: "הסתרה",
                          danger: true,
                          run: (reason) => {
                            const ok = r.targetType === "post" ? adminSetPostHidden(r.targetId, true, reason) : r.targetType === "comment" ? adminSetCommentHidden(r.targetId, true, reason) : adminSetReviewHidden(r.targetId, true, reason);
                            return ok === undefined ? undefined : adminResolveReport(r.id, "resolved", reason);
                          },
                        })
                      }
                    >
                      הסתרה וסגירה
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => ask({ title: "לסמן כמטופל?", label: "סגירה", run: (reason) => adminResolveReport(r.id, "resolved", reason) })}>
                    סימון כמטופל
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => ask({ title: "לדחות את הדיווח?", body: "התוכן יישאר גלוי.", label: "דחייה", run: (reason) => adminResolveReport(r.id, "dismissed", reason) })}>
                    דחייה
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Businesses({ db, ask }: { db: DB; ask: Ask }) {
  const order = { pending: 0, suspended: 1, active: 2 };
  const list = [...db.businesses].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <Table head={["עסק", "עיר", "סטטוס", "תורים", "פעולות"]}>
      {list.map((b) => (
        <tr key={b.id}>
          <td className="p-3">
            <Link to={`/b/${b.id}`} className="flex items-center gap-2 font-semibold">
              <Avatar src={b.avatar} name={b.name} size={32} /> {b.name}
            </Link>
          </td>
          <td className="p-3">{db.cities.find((c) => c.id === b.cityId)?.name}</td>
          <td className="p-3">
            <Badge tone={b.status === "active" ? "ok" : b.status === "pending" ? "warn" : "bad"}>{b.status === "active" ? "פעיל" : b.status === "pending" ? "ממתין לאישור" : "מושעה"}</Badge>
            {b.statusReason && b.status !== "active" && <div className="mt-1 text-xs text-muted">{b.statusReason}</div>}
          </td>
          <td className="num p-3">{db.appointments.filter((a) => a.businessId === b.id).length}</td>
          <td className="p-3">
            <div className="flex gap-2">
              {b.status === "pending" && (
                <Button size="sm" onClick={() => ask({ title: `לאשר את ${b.name}?`, body: "העסק יופיע בחיפוש ובפיד.", label: "אישור", run: (r) => adminSetBusinessStatus(b.id, "active", r) })}>
                  אישור
                </Button>
              )}
              {b.status === "active" && (
                <Button size="sm" variant="danger" onClick={() => ask({ title: `להשעות את ${b.name}?`, body: "הפרופיל והתוכן יוסתרו והזמנות חדשות ייחסמו. תורים קיימים לא מבוטלים אוטומטית.", label: "השעיה", danger: true, run: (r) => adminSetBusinessStatus(b.id, "suspended", r) })}>
                  השעיה
                </Button>
              )}
              {b.status === "suspended" && (
                <Button size="sm" variant="secondary" onClick={() => ask({ title: `לשחזר את ${b.name}?`, label: "שחזור", run: (r) => adminSetBusinessStatus(b.id, "active", r) })}>
                  שחזור
                </Button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

function Users({ db, ask }: { db: DB; ask: Ask }) {
  const [q, setQ] = useState("");
  const role = { customer: "לקוח/ה", business: "בעל/ת עסק", staff: "צוות", admin: "מנהל/ת" };
  const list = db.users.filter((u) => u.name.includes(q) || u.username.includes(q));
  return (
    <>
      <Input className="mb-3 max-w-sm" placeholder="חיפוש משתמש" aria-label="חיפוש משתמש" value={q} onChange={(e) => setQ(e.target.value)} />
      <Table head={["שם", "תפקיד", "עיר", "סטטוס", "פעולות"]}>
        {list.map((u) => (
          <tr key={u.id}>
            <td className="p-3 font-semibold">{u.name}</td>
            <td className="p-3">{role[u.role]}</td>
            <td className="p-3">{db.cities.find((c) => c.id === u.cityId)?.name ?? "—"}</td>
            <td className="p-3">
              <Badge tone={u.status === "active" ? "ok" : "bad"}>{u.status === "active" ? "פעיל" : "מושעה"}</Badge>
            </td>
            <td className="p-3">
              {u.role !== "admin" &&
                (u.status === "active" ? (
                  <Button size="sm" variant="danger" onClick={() => ask({ title: `להשעות את ${u.name}?`, label: "השעיה", danger: true, run: (r) => adminSetUserStatus(u.id, "suspended", r) })}>
                    השעיה
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => ask({ title: `לשחזר את ${u.name}?`, label: "שחזור", run: (r) => adminSetUserStatus(u.id, "active", r) })}>
                    שחזור
                  </Button>
                ))}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Moderation({ db, ask }: { db: DB; ask: Ask }) {
  const hiddenPosts = db.posts.filter((p) => p.status === "hidden");
  const hiddenReviews = db.reviews.filter((r) => r.hidden);
  const hiddenComments = db.comments.filter((c) => c.hidden);
  const recent = db.posts.filter((p) => p.status === "published").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 8);
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 font-bold">תוכן מוסתר</h2>
        {hiddenPosts.length + hiddenReviews.length + hiddenComments.length === 0 && <p className="text-sm text-muted">אין תוכן מוסתר.</p>}
        <ul className="flex flex-col gap-2">
          {hiddenPosts.map((p) => (
            <ModRow key={p.id} label={`פוסט · ${db.businesses.find((b) => b.id === p.businessId)?.name}`} text={p.caption} reason={p.hiddenReason} onRestore={() => ask({ title: "לשחזר את הפוסט?", label: "שחזור", run: (r) => adminSetPostHidden(p.id, false, r) })} />
          ))}
          {hiddenReviews.map((x) => (
            <ModRow key={x.id} label="ביקורת" text={x.text} reason={x.hiddenReason} onRestore={() => ask({ title: "לשחזר את הביקורת?", label: "שחזור", run: (r) => adminSetReviewHidden(x.id, false, r) })} />
          ))}
          {hiddenComments.map((c) => (
            <ModRow key={c.id} label="תגובה" text={c.text} onRestore={() => ask({ title: "לשחזר את התגובה?", label: "שחזור", run: (r) => adminSetCommentHidden(c.id, false, r) })} />
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-bold">פרסומים אחרונים</h2>
        <ul className="flex flex-col gap-2">
          {recent.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line p-3 text-sm">
              <Link to={`/post/${p.id}`} className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                {db.businesses.find((b) => b.id === p.businessId)?.name} · {p.caption}
              </Link>
              <Button size="sm" variant="danger" onClick={() => ask({ title: "להסתיר את הפוסט?", body: "העסק יקבל התראה עם הסיבה.", label: "הסתרה", danger: true, run: (r) => adminSetPostHidden(p.id, true, r) })}>
                הסתרה
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ModRow({ label, text, reason, onRestore }: { label: string; text: string; reason?: string; onRestore: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="truncate">{text}</div>
        {reason && <div className="text-xs text-bad">סיבה: {reason}</div>}
      </div>
      <Button size="sm" variant="secondary" onClick={onRestore}>
        שחזור
      </Button>
    </li>
  );
}

function AppointmentSupport({ db, ask }: { db: DB; ask: Ask }) {
  const [q, setQ] = useState("");
  const list = db.appointments
    .filter((a) => {
      const name = a.customerId ? db.users.find((u) => u.id === a.customerId)?.name ?? "" : a.guestName ?? "";
      const b = db.businesses.find((x) => x.id === a.businessId)?.name ?? "";
      return !q || name.includes(q) || b.includes(q) || a.id.includes(q);
    })
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    .slice(0, 40);
  return (
    <>
      <Input className="mb-3 max-w-sm" placeholder="חיפוש לפי לקוח, עסק או מזהה" aria-label="חיפוש תור" value={q} onChange={(e) => setQ(e.target.value)} />
      <Table head={["מזהה", "לקוח/ה", "עסק", "מועד", "סטטוס", ""]}>
        {list.map((a) => (
          <tr key={a.id}>
            <td className="num p-3 text-xs text-muted">{a.id.slice(-6)}</td>
            <td className="p-3">{a.customerId ? db.users.find((u) => u.id === a.customerId)?.name : `${a.guestName} (ידני)`}</td>
            <td className="p-3">{db.businesses.find((b) => b.id === a.businessId)?.name}</td>
            <td className="num p-3">{fmtDateTime(a.start)}</td>
            <td className="p-3">
              <StatusBadge a={a} />
            </td>
            <td className="p-3">
              {["pending_approval", "pending_payment", "confirmed"].includes(a.status) && (
                <Button size="sm" variant="danger" onClick={() => ask({ title: "לבטל את התור מטעם Beautigo?", body: "הלקוח/ה והעסק יקבלו התראה באפליקציה.", label: "ביטול", danger: true, run: (r) => adminCancelAppointment(a.id, r) })}>
                  ביטול
                </Button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-muted">סטטוסים: {Object.values(STATUS_LABEL).join(" · ")}</p>
    </>
  );
}

function Cities({ db, ask }: { db: DB; ask: Ask }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h2 className="mb-2 font-bold">ערים</h2>
        <ul className="flex flex-col gap-2">
          {db.cities.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line p-3 text-sm">
              <span className="flex-1 font-semibold">{c.name}</span>
              <span className="text-xs text-muted">{db.businesses.filter((b) => b.cityId === c.id).length} עסקים</span>
              <Badge tone={c.active ? "ok" : "outline"}>{c.active ? "פעילה" : "כבויה"}</Badge>
              <Button size="sm" variant="secondary" onClick={() => ask({ title: `${c.active ? "לכבות" : "להפעיל"} את ${c.name}?`, body: c.active ? "העיר לא תופיע בבחירת עיר להרשמה ולהגדרות." : undefined, label: c.active ? "כיבוי" : "הפעלה", run: (r) => adminSetCityActive(c.id, !c.active, r) })}>
                {c.active ? "כיבוי" : "הפעלה"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-bold">קטגוריות</h2>
        <ul className="flex flex-col gap-2">
          {CATEGORIES.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-2xl border border-line p-3 text-sm">
              <span className="font-semibold">{c.label}</span>
              <span className="text-xs text-muted">{db.businesses.filter((b) => b.categories.includes(c.id)).length} עסקים</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">עריכת קטגוריות מתוכננת לגרסה הבאה (רשימה קבועה בדמו).</p>
      </section>
    </div>
  );
}

function Campaigns({ db }: { db: DB }) {
  return (
    <>
      <DemoLabel className="mb-3">קונספט — ללא חיוב, מדדים מדומים</DemoLabel>
      <Table head={["עסק", "ערים", "תקציב", "חשיפות", "הזמנות", "סטטוס", ""]}>
        {db.campaigns.map((c) => (
          <tr key={c.id}>
            <td className="p-3">{db.businesses.find((b) => b.id === c.businessId)?.name}</td>
            <td className="p-3">{c.cityIds.map((id) => db.cities.find((x) => x.id === id)?.name).join(", ")}</td>
            <td className="num p-3">{price(c.budget)}</td>
            <td className="num p-3">{compact(c.metrics.impressions)}</td>
            <td className="num p-3">{c.metrics.bookings}</td>
            <td className="p-3">
              <Badge tone={c.status === "active" ? "ok" : "outline"}>{c.status === "active" ? "פעיל" : c.status === "paused" ? "מושהה" : "הסתיים"}</Badge>
            </td>
            <td className="p-3">
              {c.status !== "ended" && (
                <Button size="sm" variant="secondary" onClick={() => setCampaignStatus(c.id, c.status === "active" ? "paused" : "active") !== undefined && toast("ok", "עודכן ונרשם ביומן")}>
                  {c.status === "active" ? "השהיה" : "הפעלה"}
                </Button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Payments({ db }: { db: DB }) {
  return (
    <>
      <DemoLabel className="mb-3">תשלומים מדומים — לא בוצעה סליקה ולא נשמרו פרטי כרטיס</DemoLabel>
      <Table head={["תאריך", "עסק", "לקוח/ה", "סכום", "סטטוס"]}>
        {[...db.payments].reverse().map((p) => (
          <tr key={p.id}>
            <td className="num p-3">{fmtShortDate(p.createdAt)}</td>
            <td className="p-3">{db.businesses.find((b) => b.id === p.businessId)?.name}</td>
            <td className="p-3">{db.users.find((u) => u.id === p.customerId)?.name}</td>
            <td className="num p-3">{price(p.amount)}</td>
            <td className="p-3">
              <Badge tone={p.status === "succeeded_demo" ? "ok" : p.status === "failed_demo" ? "bad" : "neutral"}>{p.status === "succeeded_demo" ? "הצליח (דמו)" : p.status === "failed_demo" ? "נכשל (דמו)" : "הוחזר (דמו)"}</Badge>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Integrations({ db, ask }: { db: DB; ask: Ask }) {
  const list = db.integrationEvents;
  if (!list.length) return <EmptyState title="אין אירועי אינטגרציה" />;
  return (
    <ul className="flex flex-col gap-2">
      {list.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3 text-sm">
          <Badge tone={e.resolved ? "outline" : e.level === "error" ? "bad" : "neutral"}>{e.resolved ? "טופל" : e.level === "error" ? "שגיאה" : "מידע"}</Badge>
          <span className="font-semibold">{db.businesses.find((b) => b.id === e.businessId)?.name}</span>
          <span className="text-muted">{e.integration === "google_calendar" ? "Google Calendar (סימולציה)" : "תשלומים (דמו)"}</span>
          <span className="min-w-0 flex-1">{e.message}</span>
          <span className="text-xs text-muted">{fmtRelative(e.createdAt)}</span>
          {!e.resolved && (
            <Button size="sm" variant="secondary" onClick={() => ask({ title: "לסמן את התקלה כמטופלת?", label: "סימון", run: (r) => adminResolveIntegration(e.id, r) })}>
              סימון כמטופל
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Roles() {
  const rows = [
    ["אורח/ת", "צפייה בפיד, חיפוש ופרופילים", "לייק, שמירה, תגובה, הזמנה (מתבקש/ת להתחבר)"],
    ["לקוח/ה", "מעקב, שמירה, תגובה, הזמנה, ביקורת אחרי תור, הודעות", "יצירת תוכן"],
    ["בעל/ת עסק", "תוכן, יומן, שירותים, צוות, לקוחות, נתונים, תגובה לביקורות", "מחיקת ביקורות, הזמנה כלקוח"],
    ["צוות", "היומן והתורים של עצמו בלבד", "מחירים, שירותים, נתונים, הודעות"],
    ["מנהל/ת מערכת", "אישור/השעיה, מודרציה, דיווחים, תמיכה, יומן פעולות", "פעולה ללא סיבה"],
  ];
  return (
    <>
      <p className="mb-3 text-sm text-muted">הרשאות נאכפות בשכבת הפעולות של הדמו. החלפת תפקיד ב״מצב דמו״ איננה אימות — בגרסה אמיתית ההרשאות ייאכפו בשרת.</p>
      <Table head={["תפקיד", "מורשה", "לא מורשה"]}>
        {rows.map(([r, ok, no]) => (
          <tr key={r}>
            <td className="p-3 font-semibold">{r}</td>
            <td className="p-3">{ok}</td>
            <td className="p-3 text-muted">{no}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Audit({ db, limit }: { db: DB; limit?: number }) {
  const ACTION: Record<string, string> = {
    suspend_business: "השעיית עסק",
    approve_business: "אישור עסק",
    restore_business: "שחזור עסק",
    hide_content: "הסתרת תוכן",
    restore_content: "שחזור תוכן",
    hide_comment: "הסתרת תגובה",
    restore_comment: "שחזור תגובה",
    hide_review: "הסתרת ביקורת",
    restore_review: "שחזור ביקורת",
    resolve_report: "טיפול בדיווח",
    dismiss_report: "דחיית דיווח",
    suspend_user: "השעיית משתמש",
    restore_user: "שחזור משתמש",
    cancel_appointment: "ביטול תור",
    activate_city: "הפעלת עיר",
    deactivate_city: "כיבוי עיר",
    resolve_integration_failure: "טיפול בתקלת אינטגרציה",
    pause_campaign: "השהיית קמפיין",
    resume_campaign: "הפעלת קמפיין",
  };
  const list = limit ? db.audit.slice(0, limit) : db.audit;
  if (!list.length) return <p className="text-sm text-muted">אין פעולות.</p>;
  return (
    <Table head={["מתי", "מי", "פעולה", "יעד", "סיבה"]}>
      {list.map((e) => (
        <tr key={e.id}>
          <td className="num p-3 text-xs">{fmtDateTime(e.createdAt)}</td>
          <td className="p-3">{db.users.find((u) => u.id === e.actorId)?.name}</td>
          <td className="p-3 font-semibold">{ACTION[e.action] ?? e.action}</td>
          <td className="num p-3 text-xs text-muted">
            {e.targetType}:{e.targetId.slice(-8)}
          </td>
          <td className="p-3">{e.reason}</td>
        </tr>
      ))}
    </Table>
  );
}
