-- CreateEnum
CREATE TYPE "MomoTransactionStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPlanDuration" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'BIENNIAL');

-- AlterEnum
ALTER TYPE "AuditActionType" ADD VALUE 'MOMO_PAYMENT_REQUESTED';
ALTER TYPE "AuditActionType" ADD VALUE 'MOMO_PAYMENT_RECEIVED';
ALTER TYPE "AuditActionType" ADD VALUE 'MOMO_PAYMENT_FAILED';
ALTER TYPE "AuditActionType" ADD VALUE 'MOMO_PAYMENT_RETRIED';
ALTER TYPE "AuditActionType" ADD VALUE 'SUBSCRIPTION_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "AuditActionType" ADD VALUE 'SUBSCRIPTION_RENEWED';

-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN     "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "momoPhoneNumber" TEXT;

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "duration" "SubscriptionPlanDuration" NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetSubscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fleetId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "startDate" TIMESTAMPTZ(6) NOT NULL,
    "endDate" TIMESTAMPTZ(6) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "momoPhoneNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FleetSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MomoTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fleetId" UUID NOT NULL,
    "billingCycleId" UUID,
    "referenceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "payerPhone" TEXT NOT NULL,
    "status" "MomoTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "financialTransactionId" TEXT,
    "failureReason" TEXT,
    "payerMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMPTZ(6),
    "callbackReceivedAt" TIMESTAMPTZ(6),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MomoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_duration_key" ON "SubscriptionPlan"("duration");

-- CreateIndex
CREATE INDEX "FleetSubscription_fleetId_idx" ON "FleetSubscription"("fleetId");

-- CreateIndex
CREATE INDEX "FleetSubscription_planId_idx" ON "FleetSubscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "MomoTransaction_referenceId_key" ON "MomoTransaction"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "MomoTransaction_idempotencyKey_key" ON "MomoTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MomoTransaction_fleetId_idx" ON "MomoTransaction"("fleetId");

-- CreateIndex
CREATE INDEX "MomoTransaction_billingCycleId_idx" ON "MomoTransaction"("billingCycleId");

-- CreateIndex
CREATE INDEX "MomoTransaction_status_idx" ON "MomoTransaction"("status");

-- CreateIndex
CREATE INDEX "MomoTransaction_referenceId_idx" ON "MomoTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "MomoTransaction_nextRetryAt_idx" ON "MomoTransaction"("nextRetryAt");

-- AddForeignKey
ALTER TABLE "FleetSubscription" ADD CONSTRAINT "FleetSubscription_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetSubscription" ADD CONSTRAINT "FleetSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MomoTransaction" ADD CONSTRAINT "MomoTransaction_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MomoTransaction" ADD CONSTRAINT "MomoTransaction_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
