#!/usr/bin/env bash
# Prepares the isolated e2e database and starts the production server for Playwright.
set -euo pipefail
case "$DATABASE_URL" in *e2e*) ;; *) echo "E2E DATABASE_URL must contain 'e2e'"; exit 1;; esac
npx prisma migrate deploy
npx tsx prisma/seed.ts
exec npx next start -p "${PORT:-3100}"
