#!/bin/sh
set -eu

# Runs Prisma migrations before booting the API when enabled via env.
run_migrations() {
  if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    npm run db:deploy -w apps/api
  fi
}

run_migrations

exec node apps/api/dist/main.js
