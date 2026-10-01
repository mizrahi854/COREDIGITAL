import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build on port 3100 with a
 * separate database (buber_e2e) that is migrated and re-seeded on every run
 * (scripts/e2e-server.sh). Run `npm run build` first.
 */
const PORT = 3100;
const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgresql://buber:buber@localhost:5432/buber_e2e?schema=public";
const e2eEnv = {
  DATABASE_URL: E2E_DB,
  MEDIA_ROOT: "./storage-e2e",
  RUN_WORKER_IN_APP: "true",
  RATE_LIMIT_DISABLED: "true",
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" }, testIgnore: /desktop\.spec\.ts/ },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } }, testMatch: /desktop\.spec\.ts/ },
  ],
  webServer: {
    command: "bash scripts/e2e-server.sh",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...e2eEnv, PORT: String(PORT) },
  },
});
