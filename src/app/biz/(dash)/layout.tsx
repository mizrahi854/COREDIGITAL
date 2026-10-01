import { getBizContext } from "@/server/biz-context";
import { BizNav } from "@/components/biz/biz-nav";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBizContext();
  return (
    <>
      <BizNav
        role={ctx.role}
        business={{ id: ctx.business.id, name: ctx.business.name, slug: ctx.business.slug, status: ctx.business.status }}
        memberships={ctx.memberships.map((m) => ({ id: m.business.id, name: m.business.name }))}
      />
      <div className="min-h-dvh md:ps-64">
        {ctx.business.status === "PENDING_REVIEW" && (
          <div className="bg-warn-soft px-4 py-2.5 text-center text-sm text-warn">העסק ממתין לבדיקת צוות BUBER. בינתיים אפשר להשלים פרופיל, שירותים ושעות — הפרופיל יוצג ללקוחות אחרי האישור.</div>
        )}
        {ctx.business.status === "SUSPENDED" && (
          <div className="bg-bad-soft px-4 py-2.5 text-center text-sm text-bad">העסק מושעה ואינו מוצג ללקוחות. לפרטים פנו לתמיכה.</div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </div>
    </>
  );
}
