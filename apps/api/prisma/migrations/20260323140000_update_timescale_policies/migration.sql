-- Update TimescaleDB compression/retention policies for telemetry
SELECT remove_compression_policy('TelemetryPoint', if_exists => TRUE);
SELECT remove_retention_policy('TelemetryPoint', if_exists => TRUE);

SELECT add_compression_policy('TelemetryPoint', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('TelemetryPoint', INTERVAL '180 days', if_not_exists => TRUE);
