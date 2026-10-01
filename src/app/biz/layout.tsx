import type { Metadata } from "next";
import { ViewerProvider } from "@/components/viewer";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: { default: "ניהול העסק", template: "%s · ניהול העסק · BUBER" } };

export default async function BizRootLayout({ children }: { children: React.ReactNode }) {
  return <ViewerProvider viewer={await getViewer()}>{children}</ViewerProvider>;
}
