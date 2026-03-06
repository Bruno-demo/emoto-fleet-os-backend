-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('OVERSPEED', 'HARSH_BRAKE', 'HARSH_ACCEL', 'HARSH_CORNER', 'CRASH', 'THEFT_SUSPECTED', 'SOS');

-- CreateEnum
CREATE TYPE "PoiType" AS ENUM ('GARAGE', 'SWAP', 'CLINIC', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'RIDER_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'BIKE_ASSIGNMENT_CHANGED';
ALTER TYPE "AuditActionType" ADD VALUE 'SOS_TRIGGERED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SOS_ALERT';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'RIDER';

-- AlterTable
ALTER TABLE "Event"
    ALTER COLUMN "type" TYPE "EventType"
    USING ("type"::"EventType");

-- CreateTable
CREATE TABLE "RiderProfile" (
    "userId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BikeAssignment" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "bikeId" UUID NOT NULL,
    "riderUserId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BikeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poi" (
    "id" UUID NOT NULL,
    "fleetId" UUID,
    "type" "PoiType" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Poi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BikeAssignment_fleetId_idx" ON "BikeAssignment"("fleetId");

-- CreateIndex
CREATE INDEX "BikeAssignment_bikeId_idx" ON "BikeAssignment"("bikeId");

-- CreateIndex
CREATE INDEX "BikeAssignment_riderUserId_idx" ON "BikeAssignment"("riderUserId");

-- CreateIndex
CREATE INDEX "BikeAssignment_active_idx" ON "BikeAssignment"("active");

-- CreateIndex
CREATE INDEX "BikeAssignment_fleetId_active_idx" ON "BikeAssignment"("fleetId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BikeAssignment_unique_active_bike_idx" ON "BikeAssignment"("bikeId") WHERE "active" = true;

-- CreateIndex
CREATE INDEX "Poi_type_idx" ON "Poi"("type");

-- CreateIndex
CREATE INDEX "Poi_fleetId_idx" ON "Poi"("fleetId");

-- CreateIndex
CREATE INDEX "Poi_active_idx" ON "Poi"("active");

-- CreateIndex
CREATE INDEX "Poi_fleetId_active_idx" ON "Poi"("fleetId", "active");

-- AddForeignKey
ALTER TABLE "RiderProfile" ADD CONSTRAINT "RiderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeAssignment" ADD CONSTRAINT "BikeAssignment_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeAssignment" ADD CONSTRAINT "BikeAssignment_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeAssignment" ADD CONSTRAINT "BikeAssignment_riderUserId_fkey" FOREIGN KEY ("riderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poi" ADD CONSTRAINT "Poi_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

