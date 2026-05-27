-- AlterEnum
ALTER TYPE "FleetType" ADD VALUE 'PERSONAL';

-- AlterTable
ALTER TABLE "Bike" ADD COLUMN "insurerUserId" UUID;

-- AlterTable
ALTER TABLE "TelemetryPoint" ADD COLUMN "batteryPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "startBatteryPct" DOUBLE PRECISION,
ADD COLUMN "endBatteryPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RoadFeature" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Bike_insurerUserId_idx" ON "Bike"("insurerUserId");

-- AddForeignKey
ALTER TABLE "Bike" ADD CONSTRAINT "Bike_insurerUserId_fkey" FOREIGN KEY ("insurerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "DeviceCommand_status_expiresAt_idx" ON "DeviceCommand"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Event_severity_createdAt_idx" ON "Event"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_fleetId_createdAt_idx" ON "Incident"("fleetId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
