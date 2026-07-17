#!/bin/sh
set -eu

# Runs Prisma migrations before booting the API when enabled via env.
run_migrations() {
  if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    ./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
  fi
}

# Configures TimescaleDB hypertable and policies after migrations ensure that the
# TelemetryPoint table exists.  Runs only when the database is configured.
setup_hypertables() {
  if [ "${RUN_MIGRATIONS:-false}" != "true" ]; then
    return
  fi

  echo "Configuring TimescaleDB hypertables..."
  psql "${DATABASE_URL}" <<'SQL'
    SELECT create_hypertable(
      '"TelemetryPoint"', 'ts',
      if_not_exists => TRUE,
      migrate_data  => TRUE
    );

    SELECT add_compression_policy(
      '"TelemetryPoint"',
      compress_after => INTERVAL '7 days',
      if_not_exists  => TRUE
    );

    SELECT add_retention_policy(
      '"TelemetryPoint"',
      drop_after    => INTERVAL '180 days',
      if_not_exists => TRUE
    );
SQL

  if [ $? -ne 0 ]; then
    echo "WARNING: Failed to configure TimescaleDB hypertables or policies. Continuing startup..."
    return 0
  fi

  echo "TimescaleDB hypertables configured"
}

run_migrations
setup_hypertables

echo "Starting API container on ${API_PUBLIC_URL:-http://localhost:${PORT:-3000}}"

exec node apps/api/dist/src/main.js
