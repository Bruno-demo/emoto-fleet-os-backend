-- Ensure TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert telemetry to hypertable
SELECT create_hypertable('TelemetryPoint', 'ts', if_not_exists => TRUE, migrate_data => TRUE);

-- Enable compression
ALTER TABLE "TelemetryPoint" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'deviceId'
);

-- Apply compression and retention policies
SELECT add_compression_policy('TelemetryPoint', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('TelemetryPoint', INTERVAL '90 days', if_not_exists => TRUE);
