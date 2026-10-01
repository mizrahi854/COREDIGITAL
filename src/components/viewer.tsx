"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { Sheet } from "./sheet";
import { ButtonLink } from "./ui";

export type Viewer = {
  id: string;
  name: string;
  isAdmin: boolean;
  businesses: { id: string; name: string; slug: string; role: "OWNER" | "STAFF" }[];
  mode: "customer" | "business";
} | null;

type Ctx = { viewer: Viewer; requireAuth: (reason: string) => boolean };
const ViewerCtx = createContext<Ctx>({ viewer: null, requireAuth: () => false });

export function useViewer() {
  return useContext(ViewerCtx);
}

/** Provides the signed-in user to client components and a sign-in prompt for gated actions. */
export function ViewerProvider({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const [reason, setReason] = useState<string | null>(null);
  const pathname = usePathname();
  const requireAuth = useCallback(
    (why: string) => {
      if (viewer) return true;
      setReason(why);
      return false;
    },
    [viewer],
  );
  const next = encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname);
  return (
    <ViewerCtx.Provider value={{ viewer, requireAuth }}>
      {children}
      <Sheet open={!!reason} onClose={() => setReason(null)} title="כדאי להתחבר">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-bronze-soft text-bronze-ink">
            <LogIn className="size-6" aria-hidden />
          </div>
          <p className="text-[15px] leading-relaxed text-ink-2">{reason}</p>
          <div className="flex w-full flex-col gap-2">
            <ButtonLink href={`/signup?next=${next}`} size="lg" className="w-full">
              הצטרפות חינם
            </ButtonLink>
            <ButtonLink href={`/login?next=${next}`} variant="secondary" size="lg" className="w-full">
              כבר יש לי חשבון
            </ButtonLink>
          </div>
        </div>
      </Sheet>
    </ViewerCtx.Provider>
  );
}
