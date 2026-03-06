-- CreateEnum
CREATE TYPE "DeviceCommandType" AS ENUM ('LOCK', 'UNLOCK');

-- CreateEnum
CREATE TYPE "DeviceCommandStatus" AS ENUM (
  'PENDING',
  'SENT',
  'ACKED',
  'FAILED',
  'EXPIRED'
);

-- Extend audit action enum with device command actions.
DO $$
BEGIN
  ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'DEVICE_COMMAND_REQUESTED';
  ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'DEVICE_COMMAND_STATUS_CHANGED';
END $$;

-- CreateTable
CREATE TABLE "DeviceCommand" (
  "id" UUID NOT NULL,
  "fleetId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "bikeId" UUID,
  "type" "DeviceCommandType" NOT NULL,
  "status" "DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByUserId" UUID NOT NULL,
  "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMPTZ(6),
  "ackedAt" TIMESTAMPTZ(6),
  "payloadJson" JSONB NOT NULL,
  "errorMessage" TEXT,
  "nonce" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DeviceCommand"
ADD CONSTRAINT "DeviceCommand_fleetId_fkey"
FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand"
ADD CONSTRAINT "DeviceCommand_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand"
ADD CONSTRAINT "DeviceCommand_bikeId_fkey"
FOREIGN KEY ("bikeId") REFERENCES "Bike"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand"
ADD CONSTRAINT "DeviceCommand_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "DeviceCommand_fleetId_idx" ON "DeviceCommand"("fleetId");

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_idx" ON "DeviceCommand"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceCommand_requestedAt_idx" ON "DeviceCommand"("requestedAt");

-- CreateIndex
CREATE INDEX "DeviceCommand_status_idx" ON "DeviceCommand"("status");
