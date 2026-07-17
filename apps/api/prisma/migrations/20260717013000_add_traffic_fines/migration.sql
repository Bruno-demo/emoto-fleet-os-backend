-- CreateTable
CREATE TABLE "TrafficFine" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "finedAt" TIMESTAMPTZ(6) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TrafficFine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrafficFine_fleetId_ticketNumber_key" ON "TrafficFine"("fleetId", "ticketNumber");

-- CreateIndex
CREATE INDEX "TrafficFine_fleetId_idx" ON "TrafficFine"("fleetId");

-- CreateIndex
CREATE INDEX "TrafficFine_riderId_idx" ON "TrafficFine"("riderId");

-- CreateIndex
CREATE INDEX "TrafficFine_status_idx" ON "TrafficFine"("status");

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "AuditActionType" ADD VALUE 'TRAFFIC_FINE_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'TRAFFIC_FINE_UPDATED';
ALTER TYPE "AuditActionType" ADD VALUE 'TRAFFIC_FINE_DELETED';
