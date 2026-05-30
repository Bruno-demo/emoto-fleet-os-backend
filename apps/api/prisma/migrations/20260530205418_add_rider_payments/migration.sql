/*
  Warnings:

  - You are about to alter the column `batteryPct` on the `TelemetryPoint` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(5,2)`.
  - You are about to alter the column `startBatteryPct` on the `Trip` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(5,2)`.
  - You are about to alter the column `endBatteryPct` on the `Trip` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(5,2)`.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PARTIAL', 'UNPAID', 'OVERDUE');

-- AlterEnum
ALTER TYPE "AuditActionType" ADD VALUE 'RIDER_PAYMENT_RECORDED';


-- AlterTable
ALTER TABLE "Trip" ALTER COLUMN "startBatteryPct" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "endBatteryPct" SET DATA TYPE DECIMAL(5,2);

-- CreateTable
CREATE TABLE "RiderPayment" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMPTZ(6) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RiderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiderPayment_fleetId_idx" ON "RiderPayment"("fleetId");

-- CreateIndex
CREATE INDEX "RiderPayment_riderId_idx" ON "RiderPayment"("riderId");

-- CreateIndex
CREATE INDEX "RiderPayment_paidAt_idx" ON "RiderPayment"("paidAt");

-- CreateIndex
CREATE INDEX "RiderPayment_fleetId_paidAt_idx" ON "RiderPayment"("fleetId", "paidAt");

-- AddForeignKey
ALTER TABLE "RiderPayment" ADD CONSTRAINT "RiderPayment_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderPayment" ADD CONSTRAINT "RiderPayment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
