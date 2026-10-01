import type { Metadata, Viewport } from "next";
import "@fontsource-variable/heebo";
import "./globals.css";
import { Toaster } from "@/components/toast";

export const metadata: Metadata = {
  title: { default: "BUBER — רואים. בוחרים. קובעים.", template: "%s · BUBER" },
  description: "רשת חברתית ליופי וטיפוח: גלו עבודות אמיתיות, מצאו את מי שעשה אותן וקבעו תור.",
  applicationName: "BUBER",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f1e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
