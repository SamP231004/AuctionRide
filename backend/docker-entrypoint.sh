#!/bin/sh
set -e

# Migrations belong in a release step for multi-replica deployments (see docs/ARCHITECTURE.md §11).
# For single-instance setups such as docker compose, opt in with RUN_MIGRATIONS=true.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Applying database migrations…"
  ./node_modules/.bin/prisma migrate deploy
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database (idempotent)…"
  node dist/scripts/seed.js
fi

exec "$@"
