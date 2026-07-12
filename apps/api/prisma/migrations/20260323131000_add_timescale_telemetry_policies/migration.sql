-- Ensure TimescaleDB extension when available.
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
--     CREATE EXTENSION IF NOT EXISTS timescaledb;
--   END IF;
-- END $$;

-- Ensure TelemetryPoint primary key includes the partitioning column for TimescaleDB.
DO $$
BEGIN
  IF to_regclass('"TelemetryPoint"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "TelemetryPoint" DROP CONSTRAINT IF EXISTS "TelemetryPoint_pkey"';
    EXECUTE 'ALTER TABLE "TelemetryPoint" ADD CONSTRAINT "TelemetryPoint_pkey" PRIMARY KEY ("id", "ts")';
  END IF;
END $$;

-- Convert telemetry to hypertable and apply policies only if TimescaleDB is active.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
     AND to_regclass('"TelemetryPoint"') IS NOT NULL THEN
    PERFORM create_hypertable('"TelemetryPoint"'::regclass, 'ts', if_not_exists => TRUE, migrate_data => TRUE);

    ALTER TABLE "TelemetryPoint" SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = '"deviceId"'
    );

    PERFORM add_compression_policy('"TelemetryPoint"', INTERVAL '7 days', if_not_exists => TRUE);
    PERFORM add_retention_policy('"TelemetryPoint"', INTERVAL '90 days', if_not_exists => TRUE);
  END IF;
END $$;
