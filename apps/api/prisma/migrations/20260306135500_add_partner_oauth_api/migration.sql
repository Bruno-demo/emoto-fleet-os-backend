-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PartnerClientStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'PARTNER_TOKEN_ISSUED';
ALTER TYPE "AuditActionType" ADD VALUE 'PARTNER_API_ACCESS';
ALTER TYPE "AuditActionType" ADD VALUE 'PARTNER_WEBHOOK_REGISTERED';
ALTER TYPE "AuditActionType" ADD VALUE 'PARTNER_WEBHOOK_DELIVERY';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "partnerWebhookId" UUID;

-- CreateTable
CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerClient" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "status" "PartnerClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PartnerClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerFleetAccess" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PartnerFleetAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerWebhook" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "secretEncrypted" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PartnerWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerClient_clientId_key" ON "PartnerClient"("clientId");

-- CreateIndex
CREATE INDEX "PartnerClient_partnerId_idx" ON "PartnerClient"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerClient_status_idx" ON "PartnerClient"("status");

-- CreateIndex
CREATE INDEX "PartnerClient_partnerId_status_idx" ON "PartnerClient"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerFleetAccess_partnerId_active_idx" ON "PartnerFleetAccess"("partnerId", "active");

-- CreateIndex
CREATE INDEX "PartnerFleetAccess_fleetId_active_idx" ON "PartnerFleetAccess"("fleetId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerFleetAccess_partnerId_fleetId_key" ON "PartnerFleetAccess"("partnerId", "fleetId");

-- CreateIndex
CREATE INDEX "PartnerWebhook_partnerId_idx" ON "PartnerWebhook"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerWebhook_partnerId_active_idx" ON "PartnerWebhook"("partnerId", "active");

-- CreateIndex
CREATE INDEX "Notification_partnerWebhookId_idx" ON "Notification"("partnerWebhookId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_partnerWebhookId_fkey" FOREIGN KEY ("partnerWebhookId") REFERENCES "PartnerWebhook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClient" ADD CONSTRAINT "PartnerClient_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFleetAccess" ADD CONSTRAINT "PartnerFleetAccess_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFleetAccess" ADD CONSTRAINT "PartnerFleetAccess_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWebhook" ADD CONSTRAINT "PartnerWebhook_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

