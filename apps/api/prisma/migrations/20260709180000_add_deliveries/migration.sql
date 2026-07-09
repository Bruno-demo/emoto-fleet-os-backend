-- AlterEnum
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'DELIVERY_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'DELIVERY_ASSIGNED';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'DELIVERY_STATUS_CHANGED';

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
        CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED');
    END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Delivery" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "riderId" UUID,
    "orderNumber" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupLat" DECIMAL(9,6) NOT NULL,
    "pickupLng" DECIMAL(9,6) NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLat" DECIMAL(9,6) NOT NULL,
    "dropoffLng" DECIMAL(9,6) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMPTZ(6),
    "pickedUpAt" TIMESTAMPTZ(6),
    "inTransitAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "failureReason" TEXT,
    "proofPhotoUrl" TEXT,
    "proofSignature" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- Ensure inTransitAt column exists
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "inTransitAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_fleetId_idx" ON "Delivery"("fleetId");
CREATE INDEX IF NOT EXISTS "Delivery_riderId_idx" ON "Delivery"("riderId");
CREATE INDEX IF NOT EXISTS "Delivery_status_idx" ON "Delivery"("status");

-- AddForeignKey
ALTER TABLE "Delivery" DROP CONSTRAINT IF EXISTS "Delivery_fleetId_fkey";
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Delivery" DROP CONSTRAINT IF EXISTS "Delivery_riderId_fkey";
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
