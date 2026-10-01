import { api } from "@/server/http";
import { getUser } from "@/server/auth";
import { getFeed } from "@/server/feed";

export const GET = api(async (req) => {
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") === "following" ? "following" : "local";
  const cursor = Number(url.searchParams.get("cursor") ?? 0) || 0;
  const user = await getUser();
  return getFeed({
    userId: user?.id,
    tab,
    cursor,
    city: user?.city ?? url.searchParams.get("city"),
    interests: user?.interests ?? [],
  });
});
