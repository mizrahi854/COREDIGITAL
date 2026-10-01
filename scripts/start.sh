#!/usr/bin/env bash
# Container entrypoint: apply migrations, seed demo data only into an EMPTY database, start the server.
set -euo pipefail
npx prisma migrate deploy
if [ "${SEED_DEMO_IF_EMPTY:-false}" = "true" ]; then
  if [ "$(npx tsx scripts/db-is-empty.ts)" = "empty" ]; then
    echo "Database is empty — loading demo data"
    npx tsx prisma/seed.ts --force
  else
    echo "Database has data — skipping demo seed"
  fi
fi
mkdir -p "${MEDIA_ROOT:-./storage}"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
