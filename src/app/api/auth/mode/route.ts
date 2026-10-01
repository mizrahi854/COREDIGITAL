import { z } from "zod";
import { api, parseJson } from "@/server/http";
import { setMode } from "@/server/auth";

const Body = z.object({ mode: z.enum(["customer", "business"]), businessId: z.string().optional() });

export const POST = api(async (req) => {
  const b = await parseJson(req, Body);
  await setMode(b.mode, b.businessId);
  return { ok: true };
});
