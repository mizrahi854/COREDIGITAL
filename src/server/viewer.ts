import "server-only";
import type { Viewer } from "@/components/viewer";
import { getSession } from "./auth";

export async function getViewer(): Promise<Viewer> {
  const s = await getSession();
  if (!s) return null;
  return {
    id: s.user.id,
    name: s.user.name,
    isAdmin: s.user.isAdmin,
    mode: s.mode === "business" ? "business" : "customer",
    businesses: s.user.memberships.map((m) => ({
      id: m.business.id,
      name: m.business.name,
      slug: m.business.slug,
      role: m.role,
    })),
  };
}
