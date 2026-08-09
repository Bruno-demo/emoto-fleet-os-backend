-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "WorkOrderType" AS ENUM ('INSTALLATION', 'OFFLINE_REPAIR', 'REMOVAL_RECLAMATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RiderPaymentSchedule" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "FleetBillingMode" AS ENUM ('FIXED_MONTHLY', 'PAYG_TRIP_VALIDATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "billingMode" "FleetBillingMode" NOT NULL DEFAULT 'PAYG_TRIP_VALIDATED',
ADD COLUMN IF NOT EXISTS "emotoPaygRatePerActiveDay" INTEGER NOT NULL DEFAULT 350;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "lastSwapAt" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "lastTripAt" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "offlineReason" TEXT,
ADD COLUMN IF NOT EXISTS "offlineReasonUpdatedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "RiderProfile" ADD COLUMN IF NOT EXISTS "assignedRate" INTEGER NOT NULL DEFAULT 15000,
ADD COLUMN IF NOT EXISTS "customScheduleDays" INTEGER,
ADD COLUMN IF NOT EXISTS "paymentSchedule" "RiderPaymentSchedule" NOT NULL DEFAULT 'DAILY';

-- AlterTable
ALTER TABLE "RiderPayment" ADD COLUMN IF NOT EXISTS "isPartial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "partialReason" TEXT;

-- AlterTable
ALTER TABLE "MomoTransaction" ADD COLUMN IF NOT EXISTS "riderId" UUID;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerWorkOrder" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "type" "WorkOrderType" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "assignedTo" UUID,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TrackerWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerWorkOrder_fleetId_idx" ON "TrackerWorkOrder"("fleetId");
CREATE INDEX IF NOT EXISTS "TrackerWorkOrder_deviceId_idx" ON "TrackerWorkOrder"("deviceId");
CREATE INDEX IF NOT EXISTS "TrackerWorkOrder_status_idx" ON "TrackerWorkOrder"("status");
CREATE INDEX IF NOT EXISTS "MomoTransaction_riderId_idx" ON "MomoTransaction"("riderId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "MomoTransaction" ADD CONSTRAINT "MomoTransaction_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TrackerWorkOrder" ADD CONSTRAINT "TrackerWorkOrder_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TrackerWorkOrder" ADD CONSTRAINT "TrackerWorkOrder_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
