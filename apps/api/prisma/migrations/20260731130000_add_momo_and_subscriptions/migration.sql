-- CreateEnum: MomoTransactionStatus
DO $$ BEGIN
    CREATE TYPE "MomoTransactionStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: SubscriptionPlanDuration
DO $$ BEGIN
    CREATE TYPE "SubscriptionPlanDuration" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'BIENNIAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: AuditActionType
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_REQUESTED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RECEIVED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_FAILED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RETRIED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CREATED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED'; EXCEPTION WHEN OTHERS THEN null; END $$;

-- AlterTable: Fleet
ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "momoPhoneNumber" TEXT;

-- CreateTable: SubscriptionPlan
CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
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

-- CreateTable: FleetSubscription
CREATE TABLE IF NOT EXISTS "FleetSubscription" (
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

-- CreateTable: MomoTransaction
CREATE TABLE IF NOT EXISTS "MomoTransaction" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_duration_key" ON "SubscriptionPlan"("duration");
CREATE INDEX IF NOT EXISTS "FleetSubscription_fleetId_idx" ON "FleetSubscription"("fleetId");
CREATE INDEX IF NOT EXISTS "FleetSubscription_planId_idx" ON "FleetSubscription"("planId");
CREATE UNIQUE INDEX IF NOT EXISTS "MomoTransaction_referenceId_key" ON "MomoTransaction"("referenceId");
CREATE UNIQUE INDEX IF NOT EXISTS "MomoTransaction_idempotencyKey_key" ON "MomoTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "MomoTransaction_fleetId_idx" ON "MomoTransaction"("fleetId");
CREATE INDEX IF NOT EXISTS "MomoTransaction_billingCycleId_idx" ON "MomoTransaction"("billingCycleId");
CREATE INDEX IF NOT EXISTS "MomoTransaction_status_idx" ON "MomoTransaction"("status");
CREATE INDEX IF NOT EXISTS "MomoTransaction_referenceId_idx" ON "MomoTransaction"("referenceId");
CREATE INDEX IF NOT EXISTS "MomoTransaction_nextRetryAt_idx" ON "MomoTransaction"("nextRetryAt");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FleetSubscription_fleetId_fkey') THEN
        ALTER TABLE "FleetSubscription" ADD CONSTRAINT "FleetSubscription_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FleetSubscription_planId_fkey') THEN
        ALTER TABLE "FleetSubscription" ADD CONSTRAINT "FleetSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MomoTransaction_fleetId_fkey') THEN
        ALTER TABLE "MomoTransaction" ADD CONSTRAINT "MomoTransaction_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MomoTransaction_billingCycleId_fkey') THEN
        ALTER TABLE "MomoTransaction" ADD CONSTRAINT "MomoTransaction_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
