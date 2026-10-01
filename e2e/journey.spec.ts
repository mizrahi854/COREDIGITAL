import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("discover a reel → open business → book → business sees it → customer sees confirmation", async ({ page, browser }) => {
  // 1. Browse the feed without an account
  await page.goto("/");
  const firstReel = page.locator("section[data-index='0']");
  await expect(firstReel).toBeVisible();
  const businessName = (await firstReel.locator("a[href^='/b/'] span.font-semibold").first().textContent())!.trim();

  // 2. Open the business profile from the reel
  await firstReel.locator("a[href^='/b/']").first().click();
  await expect(page.getByRole("heading", { level: 1, name: businessName })).toBeVisible();
  await expect(page.getByText("עסק לדוגמה · לא עסק אמיתי")).toBeVisible();
  await page.goBack();

  // 3. Book straight from the reel: service and reel are preselected
  await page.locator("section[data-index='0']").getByRole("link", { name: "קביעת תור" }).click();
  await expect(page).toHaveURL(/\/book\?.*reel=/);
  await expect(page.getByText("הגעת מסרטון")).toBeVisible();
  await expect(page.getByRole("button", { name: "שינוי" })).toBeVisible(); // service chosen, can be changed

  // pick the first available time (the first available date is auto-selected)
  const firstTime = page.getByRole("option").filter({ hasText: /^\d\d:\d\d$/ }).first();
  await expect(firstTime).toBeVisible();
  const time = (await firstTime.textContent())!.trim();
  await firstTime.click();
  await expect(page.getByRole("heading", { name: "סיכום התור" })).toBeVisible();
  await expect(page.getByText("מדיניות ביטול:")).toBeVisible();

  // 4. Booking requires an account
  await page.getByRole("button", { name: "אישור וקביעה" }).click();
  await expect(page.getByRole("dialog", { name: "כדאי להתחבר" })).toBeVisible();

  // sign in — the selection is kept in the URL
  await login(page, "customer@buber.dev");
  await page.reload();
  await expect(page.getByRole("option", { name: time, selected: true })).toBeVisible();
  await page.getByRole("button", { name: "אישור וקביעה" }).click();

  // 5. Confirmation screen with the stored appointment
  await expect(page.getByRole("heading", { name: "התור נקבע ומאושר" })).toBeVisible();
  await expect(page.getByText(time).first()).toBeVisible();
  const appointmentUrl = page.url();
  const id = appointmentUrl.split("/appointments/")[1].split("?")[0];
  await expect(page.getByText("תור מאושר")).toBeVisible();
  await expect(page.getByText("השראות מצורפות")).toBeVisible();

  // it appears in "upcoming"
  await page.goto("/appointments");
  await expect(page.locator(`a[href='/appointments/${id}']`)).toBeVisible();

  // 6. The business owner sees the appointment, its source reel and inspiration
  const owner = await browser.newContext({ baseURL: "http://localhost:3100", locale: "he-IL" });
  const op = await owner.newPage();
  await login(op, "owner@buber.dev");
  await op.goto(`/biz/appointments/${id}`);
  await expect(op.getByText("דנה כהן")).toBeVisible();
  await expect(op.getByText("השראה מהלקוח/ה")).toBeVisible();
  await expect(op.getByText(/התור הגיע מהרילס/)).toBeVisible();
  await op.goto("/biz/calendar");
  await op.getByRole("tab", { name: "שבוע" }).click();
  await expect(op.locator(`a[href='/biz/appointments/${id}']`)).toBeVisible();
  await owner.close();
});
