// Dev helper: node scripts/shot.mjs <outDir> <mobile|desktop> <loginEmail|-> <path> [path...]
import { chromium } from "@playwright/test";
const [out, kind, email, ...paths] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext(
  kind === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "he-IL" }
    : { viewport: { width: 1440, height: 900 }, locale: "he-IL" },
);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
if (email && email !== "-") {
  const r = await page.request.post(base + "/api/dev/login", { data: { email }, headers: { origin: base } });
  if (!r.ok()) console.log("login failed", r.status());
}
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  const name = p.replace(/[^a-z0-9]+/gi, "_") || "home";
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${out}/${kind}-${name}.png` });
  console.log(p, "overflowX:", overflow);
}
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].slice(0, 10).join("\n"));
await browser.close();
