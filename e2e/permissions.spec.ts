import { expect, test } from "@playwright/test";
import { api, login } from "./helpers";

async function customerAppointmentId(page: import("@playwright/test").Page) {
  await login(page, "customer@buber.dev");
  await page.goto("/appointments");
  const href = await page.locator("a[href^='/appointments/c']").first().getAttribute("href");
  await page.context().clearCookies();
  return href!.split("/").pop()!;
}

test("unauthenticated users cannot book, follow or save", async ({ page }) => {
  await page.goto("/");
  expect((await api(page.request, "POST", "/api/social", { action: "follow", targetId: "x", on: true })).status()).toBe(401);
  expect((await api(page.request, "POST", "/api/appointments", { businessId: "x", serviceId: "y", startsAt: new Date().toISOString(), idempotencyKey: "12345678" })).status()).toBe(401);
});

test("customers only access their own appointments", async ({ page }) => {
  const id = await customerAppointmentId(page);
  await login(page, "customer2@buber.dev");
  const res = await page.goto(`/appointments/${id}`);
  expect(res?.status()).toBe(404);
  for (const action of ["cancel", "reschedule", "accept", "inspiration"]) {
    const r = await api(page.request, "POST", `/api/appointments/${id}/${action}`, { startsAt: new Date().toISOString(), reelIds: [] });
    expect([404, 409]).toContain(r.status());
    expect(r.status(), action).not.toBe(200);
  }
});

test("business owners manage only their own business", async ({ page }) => {
  const id = await customerAppointmentId(page); // an appointment at אלמנד סטודיו
  await login(page, "owner-barber@buber.dev");
  expect((await api(page.request, "POST", `/api/biz/appointments/${id}/cancel`, {})).status()).toBe(403);
  const res = await page.goto(`/biz/appointments/${id}`);
  expect(res?.status()).toBe(404);
});

test("staff are limited to their own calendar", async ({ page }) => {
  await login(page, "staff@buber.dev");
  // owner-only endpoints
  expect((await api(page.request, "POST", "/api/biz/services", { name: "x" })).status()).toBe(403);
  expect((await api(page.request, "PUT", "/api/biz/profile", {})).status()).toBe(403);
  // only own appointments are listed
  const r = await api(page.request, "GET", `/api/biz/appointments?from=2020-01-01T00:00:00Z&to=2100-01-01T00:00:00Z`);
  const { appointments } = await r.json();
  expect(appointments.length).toBeGreaterThan(0);
  expect(new Set(appointments.map((a: { staff: { name: string } }) => a.staff.name))).toEqual(new Set(["שירן דוד"]));
  await page.goto("/biz/services");
  await expect(page).toHaveURL(/\/biz\/calendar/);
});

test("admin operations require an administrator", async ({ page }) => {
  await login(page, "owner@buber.dev");
  expect((await api(page.request, "POST", "/api/admin/business/anything", { action: "approve" })).status()).toBe(403);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
});

test("mutations from another origin are rejected", async ({ page }) => {
  await login(page, "customer@buber.dev");
  const r = await page.request.post("/api/social", { data: { action: "follow", targetId: "x", on: true }, headers: { origin: "https://evil.example" } });
  expect(r.status()).toBe(403);
});

test("development login is disabled in production builds", async ({ page }) => {
  await page.goto("/login");
  expect((await api(page.request, "POST", "/api/dev/login", { email: "admin@buber.dev" })).status()).toBe(404);
  await expect(page.getByText("כניסה מהירה לבדיקות")).toHaveCount(0);
});
