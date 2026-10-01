import { expect, test } from "@playwright/test";
import { login, noHorizontalOverflow } from "./helpers";

test("desktop layouts render without overflow", async ({ page }) => {
  await login(page, "admin@buber.dev");
  for (const path of ["/", "/search", "/b/blond-and-brown", "/admin", "/admin?tab=outbox"]) {
    await page.goto(path);
    await noHorizontalOverflow(page);
  }
  await expect(page.getByText("לא נשלח").first()).toBeVisible();
});
