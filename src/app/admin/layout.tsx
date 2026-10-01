import { redirect } from "next/navigation";
import { getUser } from "@/server/auth";
import { ViewerProvider } from "@/components/viewer";
import { getViewer } from "@/server/viewer";

export const metadata = { title: "ניהול מערכת" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) redirect("/");
  return <ViewerProvider viewer={await getViewer()}>{children}</ViewerProvider>;
}
