import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-night md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/auth-art.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
        <div className="absolute inset-x-10 bottom-12 text-cream">
          <p className="text-4xl font-bold leading-tight">רואים. בוחרים. קובעים.</p>
          <p className="mt-3 max-w-sm text-cream/75">ראיתם עבודה שאהבתם? גלו מי עשה אותה, כמה זה עולה ומתי יש תור — בלי להתכתב עם אף אחד.</p>
          <p className="mt-6 text-xs text-cream/50">האיור נוצר להדגמה</p>
        </div>
      </div>
      <main className="flex flex-col px-5 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))] md:px-16 md:pt-12">
        <Link href="/" className="mb-10 text-2xl" aria-label="BUBER — דף הבית">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-md flex-1">{children}</div>
      </main>
    </div>
  );
}
