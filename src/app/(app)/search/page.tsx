import type { Metadata } from "next";
import { Suspense } from "react";
import { getUser } from "@/server/auth";
import { anyReviewsExist } from "@/server/search";
import { SearchView } from "@/components/search-view";

export const metadata: Metadata = { title: "חיפוש" };

export default async function SearchPage() {
  const [user, hasReviews] = await Promise.all([getUser(), anyReviewsExist()]);
  return (
    <Suspense>
      <SearchView home={user?.city ? { city: user.city, lat: user.lat, lng: user.lng } : null} reviewsAvailable={hasReviews} />
    </Suspense>
  );
}
