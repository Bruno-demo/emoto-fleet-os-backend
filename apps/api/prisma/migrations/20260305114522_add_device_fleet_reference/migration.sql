-- AlterTable
ALTER TABLE "Device" ADD COLUMN "fleetId" UUID;

-- Backfill
UPDATE "Device" AS d
SET "fleetId" = b."fleetId"
FROM "Bike" AS b
WHERE d."bikeId" = b."id"
  AND d."fleetId" IS NULL;

-- Ensure no legacy null values remain before enforcing NOT NULL.
UPDATE "Device"
SET "fleetId" = '00000000-0000-0000-0000-000000000001'
WHERE "fleetId" IS NULL;

-- Enforce required ownership
ALTER TABLE "Device"
ALTER COLUMN "fleetId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Device_fleetId_idx" ON "Device"("fleetId");

-- CreateIndex
CREATE INDEX "Device_fleetId_status_idx" ON "Device"("fleetId", "status");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
