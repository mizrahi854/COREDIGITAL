import { z } from "zod";
import { prisma } from "@/lib/db";
import { CATEGORY_IDS, CITIES } from "@/lib/constants";
import { api, limit, parseJson } from "@/server/http";
import { getSession, requireUser } from "@/server/auth";

const Body = z.object({
  name: z.string().trim().min(2, "נא להזין שם עסק").max(60),
  categories: z.array(z.enum(CATEGORY_IDS)).min(1, "בחרו לפחות קטגוריה אחת").max(4),
  city: z.string().trim().min(2, "נא לבחור עיר").max(60),
  address: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  description: z.string().trim().max(1000).optional(),
  ownerIsStaff: z.boolean().default(true),
});

function slugify(name: string) {
  const latin = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (latin || "biz") + "-" + Math.random().toString(36).slice(2, 7);
}

/** Creates a business owned by the current user. It stays PENDING_REVIEW until an admin approves it. */
export const POST = api(async (req) => {
  const user = await requireUser();
  await limit(req, "biz-create", 5, 3600, user.id);
  const b = await parseJson(req, Body);
  const city = CITIES.find((c) => c.name === b.city);
  const biz = await prisma.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: {
        name: b.name,
        slug: slugify(b.name),
        categories: b.categories,
        city: b.city,
        address: b.address ?? "",
        phone: b.phone,
        description: b.description ?? "",
        // City centroid only as a coarse location until the owner sets an exact one.
        lat: city?.lat ?? null,
        lng: city?.lng ?? null,
        members: { create: { userId: user.id, role: "OWNER" } },
        openingHours: {
          create: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, openMin: 9 * 60, closeMin: 19 * 60 })),
        },
      },
    });
    if (b.ownerIsStaff) {
      await tx.staffMember.create({
        data: {
          businessId: created.id,
          userId: user.id,
          name: user.name,
          title: "בעלים",
          workingHours: { create: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 19 * 60 })) },
        },
      });
    }
    return created;
  });
  // Switch the current session into managing the new business.
  const session = await getSession();
  if (session) await prisma.session.update({ where: { id: session.id }, data: { mode: "business", businessId: biz.id } });
  return { id: biz.id, slug: biz.slug };
});
