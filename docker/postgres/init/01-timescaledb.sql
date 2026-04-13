CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Hypertable creation runs via the post-migration script (02-hypertables.sql)
-- because "TelemetryPoint" does not exist until Prisma migrations complete.
-- When restoring from backup, pass --clean so the table is recreated before
-- the init scripts fire on the first container start.