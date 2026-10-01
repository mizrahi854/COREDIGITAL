import { AppNav } from "@/components/app-nav";
import { ViewerProvider } from "@/components/viewer";
import { getViewer } from "@/server/viewer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <ViewerProvider viewer={viewer}>
      <AppNav />
      <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))] md:ps-60 md:pb-0">{children}</div>
    </ViewerProvider>
  );
}
