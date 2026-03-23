-- Ensure TimescaleDB extension when available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
  END IF;
END $$;

-- Convert telemetry to hypertable and apply policies only if TimescaleDB is active.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('TelemetryPoint', 'ts', if_not_exists => TRUE, migrate_data => TRUE);

    ALTER TABLE "TelemetryPoint" SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'deviceId'
    );

    PERFORM add_compression_policy('TelemetryPoint', INTERVAL '7 days', if_not_exists => TRUE);
    PERFORM add_retention_policy('TelemetryPoint', INTERVAL '90 days', if_not_exists => TRUE);
  END IF;
END $$;
