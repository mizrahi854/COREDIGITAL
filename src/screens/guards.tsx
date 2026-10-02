import type { ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { Lock } from "lucide-react";
import { useMode } from "../store/app";
import { EmptyState, LinkButton } from "../ui/kit";
import { Page, TopBar } from "../ui/shell";

type Mode = ReturnType<typeof useMode>;

/** Route-level access check (the store also enforces permissions on every action). */
export function RequireMode({ modes, children }: { modes: Mode[]; children?: ReactNode }) {
  const mode = useMode();
  const loc = useLocation();
  if (modes.includes(mode)) return children ?? <Outlet />;
  return (
    <>
      <TopBar title="אין גישה" back />
      <Page className="max-w-lg">
        <EmptyState
          icon={<Lock className="size-6" aria-hidden />}
          title={mode === "guest" ? "צריך להתחבר" : "המסך הזה לא זמין בחשבון הנוכחי"}
          text={
            mode === "guest"
              ? "התחברו כדי להמשיך."
              : modes.includes("admin")
                ? "ניהול הפלטפורמה זמין רק למנהלי מערכת."
                : modes.includes("business") && mode === "staff"
                  ? "לאנשי צוות יש גישה ליומן ולתורים שלהם בלבד."
                  : "יצירת תוכן וניהול זמינים לחשבונות עסקיים בלבד. לקוחות יכולים להגיב, לשמור ולכתוב ביקורת אחרי טיפול."
          }
          action={mode === "guest" ? <LinkButton to={`/signin?next=${encodeURIComponent(loc.pathname)}`}>התחברות</LinkButton> : <LinkButton to="/">לדף הבית</LinkButton>}
        />
      </Page>
    </>
  );
}
