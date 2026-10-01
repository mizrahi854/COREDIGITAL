import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "buber1234";

/** Real password login (dev shortcuts are disabled in the production build). */
export async function login(page: Page, email: string) {
  const base = new URL(page.url() === "about:blank" ? "http://localhost:3100" : page.url()).origin;
  const r = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD }, headers: { origin: base } });
  expect(r.ok(), await r.text()).toBeTruthy();
}

export async function api(req: APIRequestContext, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, data?: unknown) {
  return req.fetch(url, { method, data, headers: { origin: "http://localhost:3100" } });
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}
