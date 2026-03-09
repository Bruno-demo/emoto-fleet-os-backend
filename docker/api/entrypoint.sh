#!/bin/sh
set -eu

# Runs Prisma migrations before booting the API when enabled via env.
run_migrations() {
  if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    ./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
  fi
}

run_migrations

echo "Starting API container on ${API_PUBLIC_URL:-http://localhost:${PORT:-3000}}"

exec node apps/api/dist/src/main.js
