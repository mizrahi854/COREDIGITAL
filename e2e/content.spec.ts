import { expect, test } from "@playwright/test";
import { api, login, noHorizontalOverflow } from "./helpers";

test("a failed upload never becomes a published reel", async ({ page }) => {
  await login(page, "owner@buber.dev");
  // missing rights/consent confirmation is refused
  const junk = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(5000, 1)]);
  const noRights = await page.request.post("/api/biz/reels", {
    headers: { origin: "http://localhost:3100" },
    multipart: { file: { name: "a.mp4", mimeType: "video/mp4", buffer: junk }, category: "NAILS", caption: "x" },
  });
  expect(noRights.status()).toBe(400);
  // wrong file type is refused
  const notVideo = await page.request.post("/api/biz/reels", {
    headers: { origin: "http://localhost:3100" },
    multipart: { file: { name: "a.mp4", mimeType: "video/mp4", buffer: Buffer.from("hello world, not a video at all") }, category: "NAILS", rightsConfirmed: "true" },
  });
  expect(notVideo.status()).toBe(400);
  // corrupt video is accepted for processing but fails there
  const up = await page.request.post("/api/biz/reels", {
    headers: { origin: "http://localhost:3100" },
    multipart: { file: { name: "broken.mp4", mimeType: "video/mp4", buffer: junk }, category: "NAILS", caption: "סרטון שבור", rightsConfirmed: "true", publish: "true" },
  });
  expect(up.ok()).toBeTruthy();
  const { id } = await up.json();
  await page.goto("/biz/reels");
  const card = page.locator("li").filter({ hasText: "סרטון שבור" });
  await expect(card).toHaveCount(1); // the rejected uploads left no records behind
  await expect(card.getByText("העיבוד נכשל")).toBeVisible({ timeout: 30_000 });
  const feed = await (await api(page.request, "GET", "/api/feed?tab=local")).json();
  expect(feed.items.some((r: { id: string }) => r.id === id)).toBe(false);
  // publishing a failed reel is refused
  expect((await api(page.request, "PATCH", `/api/biz/reels/${id}`, { publish: true })).status()).toBe(409);
});

test("search uses stored data, filters persist, and empty states explain", async ({ page }) => {
  await page.goto("/search?category=NAILS");
  await expect(page.getByRole("heading", { name: "אלמנד סטודיו" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "הברבר של השכונה" })).toHaveCount(0);
  await noHorizontalOverflow(page);

  await page.goto("/search?q=" + encodeURIComponent("בלייאז׳"));
  await expect(page.getByRole("heading", { name: "בלונד אנד בראון" })).toBeVisible();

  // last search is restored when coming back without parameters
  await page.goto("/search");
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("heading", { name: "בלונד אנד בראון" })).toBeVisible();

  await page.goto("/search?q=zzzzzz");
  await expect(page.getByText("לא מצאנו עסקים מתאימים")).toBeVisible();
  await page.getByRole("button", { name: "ניקוי מסננים" }).click();
  await expect(page).toHaveURL(/\/search$/);

  // price filter is applied on the server
  const res = await (await page.request.get("/api/search?maxPrice=90")).json();
  for (const b of res.results) for (const s of b.services) expect(s.priceAgorot).toBeLessThanOrEqual(9000);
  // no distance is invented without coordinates
  const plain = await (await page.request.get("/api/search")).json();
  expect(plain.results.every((b: { distanceKm: number | null }) => b.distanceKm === null)).toBe(true);
});

test("saved content and collections persist", async ({ page }) => {
  await login(page, "customer2@buber.dev");
  await page.goto("/");
  const reel = page.locator("section[data-index='0']");
  await reel.getByRole("button", { name: "שמירה" }).first().click();
  await expect(page.getByText("נשמר בשמורים")).toBeVisible();
  await page.getByRole("button", { name: "הוספה לאוסף" }).click();
  const dialog = page.getByRole("dialog", { name: "הוספה לאוסף" });
  await dialog.getByLabel("שם אוסף חדש").fill("השראה לקיץ");
  await dialog.getByRole("button", { name: "יצירה" }).click();
  await expect(dialog.getByRole("button", { name: /השראה לקיץ/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await page.goto("/saved");
  await expect(page.getByRole("button", { name: /השראה לקיץ/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /השראה לקיץ/ }).click();
  await expect(page.locator("main li a[href^='/reel/']")).toHaveCount(1);
});

test("only the active video plays, and it pauses when scrolled away", async ({ page }) => {
  await page.goto("/");
  const v0 = page.locator("section[data-index='0'] video");
  await expect.poll(() => v0.evaluate((v: HTMLVideoElement) => !v.paused && v.muted)).toBe(true);
  await page.locator("section[data-index='1']").scrollIntoViewIfNeeded();
  const v1 = page.locator("section[data-index='1'] video");
  await expect.poll(() => v1.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
  expect(await v0.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  const playing = await page.locator("video").evaluateAll((vs) => vs.filter((v) => !(v as HTMLVideoElement).paused).length);
  expect(playing).toBe(1);
});

test("reduced motion: videos do not autoplay and offer a play button", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100", reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForTimeout(1500);
  expect(await page.locator("section[data-index='0'] video").evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.locator("section[data-index='0']").getByRole("button", { name: "הפעלה" }).click();
  await expect.poll(() => page.locator("section[data-index='0'] video").evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
  await ctx.close();
});

test("mobile RTL pages do not overflow horizontally", async ({ page }) => {
  await login(page, "customer@buber.dev");
  for (const path of ["/", "/search", "/saved", "/appointments", "/profile", "/b/almond-nail-studio", "/b/almond-nail-studio/book", "/login"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await noHorizontalOverflow(page);
  }
  await page.context().clearCookies();
  await login(page, "owner@buber.dev");
  for (const path of ["/biz", "/biz/calendar", "/biz/services", "/biz/team", "/biz/reels", "/biz/profile"]) {
    await page.goto(path);
    await noHorizontalOverflow(page);
  }
});
