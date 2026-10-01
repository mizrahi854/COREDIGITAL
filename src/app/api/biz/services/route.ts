import { prisma } from "@/lib/db";
import { api, parseJson } from "@/server/http";
import { requireBusinessAccess } from "@/server/access";
import { ServiceBody, assertStaffInBusiness } from "./schema";

export const POST = api(async (req) => {
  const access = await requireBusinessAccess({ ownerOnly: true });
  const { staffIds, ...b } = await parseJson(req, ServiceBody);
  await assertStaffInBusiness(access.businessId, staffIds);
  const s = await prisma.service.create({
    data: { ...b, businessId: access.businessId, staff: { create: staffIds.map((staffId) => ({ staffId })) } },
  });
  return { id: s.id };
});
