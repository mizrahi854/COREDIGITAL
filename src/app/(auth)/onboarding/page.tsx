import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/server/auth";
import { Onboarding } from "@/components/onboarding";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <Suspense>
      <Onboarding initial={{ city: user.city, lat: user.lat, lng: user.lng, interests: user.interests }} />
    </Suspense>
  );
}
