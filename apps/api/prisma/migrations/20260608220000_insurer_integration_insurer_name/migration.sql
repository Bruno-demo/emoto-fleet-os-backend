-- AlterEnum
ALTER TYPE "FleetPlan" ADD VALUE 'INSURANCE';

-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN "insurerName" TEXT;

-- DropForeignKey
ALTER TABLE "Bike" DROP CONSTRAINT IF EXISTS "Bike_insurerUserId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Bike_insurerUserId_idx";

-- AlterTable
ALTER TABLE "Bike" DROP COLUMN "insurerUserId";
ALTER TABLE "Bike" ADD COLUMN "insurerName" TEXT;

-- CreateIndex
CREATE INDEX "Bike_insurerName_idx" ON "Bike"("insurerName");
