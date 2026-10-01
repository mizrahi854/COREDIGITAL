import { redirect } from "next/navigation";
import { getUser } from "@/server/auth";
import { NewBusinessForm } from "@/components/biz/new-business-form";
import { Logo } from "@/components/ui";

export const metadata = { title: "פתיחת עסק" };

export default async function NewBusinessPage() {
  const user = await getUser();
  if (!user) redirect("/signup?next=/biz/new");
  return (
    <main className="mx-auto max-w-xl px-5 pb-16 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="mb-8 text-2xl">
        <Logo />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">פתיחת פרופיל עסקי</h1>
      <p className="mb-6 mt-1 text-muted">כמה פרטים בסיסיים — אחר כך תוסיפו שירותים, צוות ורילס. הפרופיל יפורסם אחרי בדיקה קצרה של צוות BUBER.</p>
      <NewBusinessForm />
    </main>
  );
}
