-- Update TimescaleDB compression/retention policies for telemetry when TimescaleDB is active.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM remove_compression_policy('"TelemetryPoint"', if_exists => TRUE);
    PERFORM remove_retention_policy('"TelemetryPoint"', if_exists => TRUE);

    PERFORM add_compression_policy('"TelemetryPoint"', INTERVAL '7 days', if_not_exists => TRUE);
    PERFORM add_retention_policy('"TelemetryPoint"', INTERVAL '180 days', if_not_exists => TRUE);
  END IF;
END $$;
