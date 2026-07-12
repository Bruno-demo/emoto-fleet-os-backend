/*
  Warnings:

  - A unique constraint covering the columns `[deviceId,ts,type]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deviceId,ts]` on the table `TelemetryPoint` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'GEOFENCE_EXIT';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERY_UPDATE';

-- AlterEnum
ALTER TYPE "ZoneType" ADD VALUE 'WORK_BOUNDARY';

-- DropForeignKey
ALTER TABLE "BillingCycle" DROP CONSTRAINT "BillingCycle_fleetId_fkey";

-- DropForeignKey
ALTER TABLE "BillingPayment" DROP CONSTRAINT "BillingPayment_billingCycleId_fkey";

-- DropForeignKey
ALTER TABLE "BillingPayment" DROP CONSTRAINT "BillingPayment_fleetId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Event_deviceId_ts_type_key" ON "Event"("deviceId", "ts", "type");

-- CreateIndex
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM remove_compression_policy('"TelemetryPoint"', if_exists => TRUE);
    EXECUTE 'ALTER TABLE "TelemetryPoint" SET (timescaledb.compress = false)';
  END IF;
END $$;

CREATE UNIQUE INDEX "TelemetryPoint_deviceId_ts_key" ON "TelemetryPoint"("deviceId", "ts");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    EXECUTE 'ALTER TABLE "TelemetryPoint" SET (timescaledb.compress = true, timescaledb.compress_segmentby = ''"deviceId"'')';
    PERFORM add_compression_policy('"TelemetryPoint"', INTERVAL '7 days', if_not_exists => TRUE);
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
