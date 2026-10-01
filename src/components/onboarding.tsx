"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@prisma/client";
import { apiFetch } from "@/lib/client";
import { AreaPicker, InterestPicker, type AreaValue } from "./area-interests";
import { Button } from "./ui";

export function Onboarding({ initial }: { initial: AreaValue & { interests: Category[] } }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [step, setStep] = useState(0);
  const [area, setArea] = useState<AreaValue>(initial);
  const [interests, setInterests] = useState<Category[]>(initial.interests);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/me", { method: "PATCH", body: { ...area, interests, onboarded: true } });
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-sand-2"}`} />
        ))}
      </div>
      {step === 0 ? (
        <>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">איפה לחפש בשבילך?</h1>
            <p className="mt-1 text-muted">נציג קודם עבודות של עסקים באזור שלך.</p>
          </div>
          <AreaPicker value={area} onChange={setArea} />
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => setStep(1)}>
              המשך
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setStep(1)}>
              דילוג
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">מה מעניין אותך?</h1>
            <p className="mt-1 text-muted">אפשר לבחור כמה. תמיד אפשר לשנות בפרופיל.</p>
          </div>
          <InterestPicker value={interests} onChange={setInterests} />
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={finish} loading={busy}>
              סיום ומעבר לפיד
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setStep(0)}>
              חזרה
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
