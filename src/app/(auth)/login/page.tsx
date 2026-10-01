import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { devLoginEnabled } from "@/server/auth";

export const metadata: Metadata = { title: "התחברות" };

export default function LoginPage() {
  const dev = devLoginEnabled()
    ? [
        { email: "customer@buber.dev", label: "לקוחה (דנה)" },
        { email: "owner@buber.dev", label: "בעלת עסק (אלמנד)" },
        { email: "staff@buber.dev", label: "צוות (שירן)" },
        { email: "admin@buber.dev", label: "מנהלת מערכת" },
        { email: "customer2@buber.dev", label: "לקוח נוסף (יואב)" },
        { email: "owner-barber@buber.dev", label: "בעל ברברשופ" },
      ]
    : null;
  return (
    <Suspense>
      <LoginForm devAccounts={dev} />
    </Suspense>
  );
}
