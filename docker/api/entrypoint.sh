#!/bin/sh
set -eu

run_migrations() {
  if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Syncing database enum ownership and values..."
    psql "${DATABASE_URL}" <<'SQL' || true
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT t.typname
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typtype = 'e'
        ) LOOP
          BEGIN
            EXECUTE 'ALTER TYPE public.' || quote_ident(r.typname) || ' OWNER TO ' || quote_ident(CURRENT_USER);
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END LOOP;
      END $$;

      DO $$
      BEGIN
        ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'PAYG';
        ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'INSURANCE';
        ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;

      DO $$
      BEGIN
        ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_REQUESTED';
        ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RECEIVED';
        ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_FAILED';
        ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RETRIED';
        ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CREATED';
        ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED';
        ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
SQL

    echo "Running Prisma schema sync..."
    ./apps/api/node_modules/.bin/prisma db push --schema apps/api/prisma/schema.prisma --accept-data-loss || true
  fi
}

# Configures TimescaleDB hypertable and policies after migrations ensure that the
# TelemetryPoint table exists.  Runs only when the database is configured.
setup_hypertables() {
  if [ "${RUN_MIGRATIONS:-false}" != "true" ]; then
    return
  fi

  echo "Configuring TimescaleDB hypertables..."
  psql "${DATABASE_URL}" <<'SQL' || true
    DO $$
    BEGIN
      -- Attempt to claim table ownership if running as db owner
      EXECUTE 'ALTER TABLE "TelemetryPoint" OWNER TO ' || quote_ident(CURRENT_USER);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if not superuser
      NULL;
    END $$;

    SELECT create_hypertable(
      '"TelemetryPoint"', 'ts',
      if_not_exists => TRUE,
      migrate_data  => TRUE
    );

    DO $$
    BEGIN
      PERFORM add_compression_policy(
        '"TelemetryPoint"',
        compress_after => INTERVAL '7 days',
        if_not_exists  => TRUE
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping compression policy: %', SQLERRM;
    END $$;

    DO $$
    BEGIN
      PERFORM add_retention_policy(
        '"TelemetryPoint"',
        drop_after    => INTERVAL '180 days',
        if_not_exists => TRUE
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping retention policy: %', SQLERRM;
    END $$;
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
