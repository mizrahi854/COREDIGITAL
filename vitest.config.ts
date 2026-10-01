import { defineConfig } from "vitest/config";
import path from "node:path";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://buber:buber@localhost:5432/buber_test?schema=public";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/support/global-setup.ts"],
    env: { DATABASE_URL: TEST_DB, MEDIA_ROOT: path.resolve(__dirname, "storage-test"), RATE_LIMIT_DISABLED: "true" },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
