-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'TRACKER_OFFLINE';

-- AlterEnum
ALTER TYPE "AuditActionType" ADD VALUE 'PARTNER_DELETED';
ALTER TYPE "AuditActionType" ADD VALUE 'INSURER_DELETED';

-- DropIndex
DROP INDEX IF EXISTS "Trip_bikeId_startTs_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Trip_bikeId_startTs_key" ON "Trip"("bikeId", "startTs");
