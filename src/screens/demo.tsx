import { useState } from "react";
import { useNavigate } from "react-router";
import { Briefcase, CalendarDays, Eye, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import clsx from "clsx";
import { DEMO_ACCOUNTS } from "../data/seed";
import { resetDemo, signInAs } from "../store/actions";
import { useApp, useMe } from "../store/app";
import { Avatar, Button, Card, DemoLabel } from "../ui/kit";
import { ConfirmDialog, Sheet } from "../ui/overlays";
import { Page, TopBar } from "../ui/shell";

const ROLES = [
  { id: null, label: "אורח/ת", desc: "גלישה בפיד, חיפוש ופרופילים. הזמנה דורשת התחברות.", icon: Eye },
  { id: DEMO_ACCOUNTS.customer, label: "לקוחה — דנה כהן", desc: "עוקבת, שומרת, מזמינה, כותבת ביקורות ושולחת הודעות.", icon: UserRound },
  { id: DEMO_ACCOUNTS.owner, label: "בעלת עסק — סטודיו נובה", desc: "יוצרת תוכן, מנהלת יומן, שירותים, צוות ונתונים.", icon: Briefcase },
  { id: DEMO_ACCOUNTS.staff, label: "צוות — נועה (סטודיו נובה)", desc: "גישה מוגבלת: רק היומן והתורים שלה.", icon: CalendarDays },
  { id: DEMO_ACCOUNTS.admin, label: "מנהלת פלטפורמה", desc: "ניהול כלל הרשת: עסקים, דיווחים, תוכן ויומן פעולות.", icon: ShieldCheck },
] as const;

function RolePicker({ onPicked }: { onPicked?: () => void }) {
  const userId = useApp((s) => s.userId);
  const navigate = useNavigate();
  return (
    <ul className="flex flex-col gap-2">
      {ROLES.map((r) => {
        const on = userId === r.id;
        return (
          <li key={r.label}>
            <button
              type="button"
              onClick={() => {
                signInAs(r.id);
                onPicked?.();
                navigate(r.id === DEMO_ACCOUNTS.admin ? "/admin" : r.id === DEMO_ACCOUNTS.staff ? "/manage" : "/");
              }}
              aria-pressed={on}
              className={clsx("flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition", on ? "border-ink bg-surface" : "border-line hover:bg-surface")}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2">
                <r.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{r.label}</span>
                <span className="block text-sm text-muted">{r.desc}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Clearly labelled demo role switcher, separate from the product journey. */
export function DemoScreen() {
  const me = useMe();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <TopBar title="מצב דמו" back />
      <Page className="max-w-2xl">
        <Card className="mb-5 flex flex-col gap-2 bg-surface p-5">
          <div className="flex items-center gap-2">
            <DemoLabel>דמו מקומי</DemoLabel>
          </div>
          <p className="text-[15px] leading-relaxed">
            החלפת תפקיד היא כלי הדגמה בלבד — <b>זו לא התחברות או אבטחה אמיתית</b>. כל הנתונים נשמרים רק בדפדפן הזה. עסקים, אנשים, ביקורות ומדיה הם לדוגמה.
          </p>
          {me && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Avatar name={me.name} size={24} /> מחובר/ת כעת כ־{me.name}
            </p>
          )}
        </Card>
        <h2 className="mb-3 text-lg font-bold">כניסה כ־</h2>
        <RolePicker />
        <div className="mt-8 border-t border-line pt-5">
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            <RotateCcw className="size-4" aria-hidden /> איפוס נתוני הדמו
          </Button>
          <p className="mt-2 text-xs text-muted">מחזיר את כל העסקים, התורים וההודעות למצב ההתחלתי במכשיר הזה.</p>
        </div>
      </Page>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="לאפס את נתוני הדמו?" body="כל השינויים שעשית (תורים, פוסטים, הודעות) יימחקו במכשיר הזה." confirmLabel="איפוס" danger onConfirm={() => resetDemo()} />
    </>
  );
}

export function WelcomeSheet() {
  const welcomed = useApp((s) => s.welcomed);
  const close = () => useApp.setState({ welcomed: true });
  return (
    <Sheet open={!welcomed} onClose={close} title="ברוכים הבאים ל־Beautigo">
      <p className="mb-4 text-[15px] leading-relaxed text-muted">
        רשת חברתית ליופי: רואים עבודות אמיתיות, בוחרים איש מקצוע וקובעים תור ישר מהתוכן. זהו <b className="text-ink">דמו מקומי</b> — בחרו איך להיכנס. אפשר להחליף בכל רגע דרך ״מצב דמו״.
      </p>
      <RolePicker onPicked={close} />
    </Sheet>
  );
}
