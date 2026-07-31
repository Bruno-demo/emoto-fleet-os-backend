-- CreateEnum: MomoTransactionStatus
DO $$ BEGIN
    CREATE TYPE "MomoTransactionStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN OTHERS THEN null; END $$;

-- CreateEnum: SubscriptionPlanDuration
DO $$ BEGIN
    CREATE TYPE "SubscriptionPlanDuration" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'BIENNIAL');
EXCEPTION WHEN OTHERS THEN null; END $$;

-- AlterEnum: AuditActionType
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_REQUESTED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RECEIVED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_FAILED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RETRIED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CREATED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED'; EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED'; EXCEPTION WHEN OTHERS THEN null; END $$;

-- AlterTable: Fleet
DO $$ BEGIN
    ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "momoPhoneNumber" TEXT;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- CreateTable: SubscriptionPlan
DO $$ BEGIN
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
EXCEPTION WHEN OTHERS THEN null; END $$;

-- CreateTable: FleetSubscription
DO $$ BEGIN
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
EXCEPTION WHEN OTHERS THEN null; END $$;

-- CreateTable: MomoTransaction
DO $$ BEGIN
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
EXCEPTION WHEN OTHERS THEN null; END $$;

-- CreateIndex
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_duration_key" ON "SubscriptionPlan"("duration"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "FleetSubscription_fleetId_idx" ON "FleetSubscription"("fleetId"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "FleetSubscription_planId_idx" ON "FleetSubscription"("planId"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "MomoTransaction_referenceId_key" ON "MomoTransaction"("referenceId"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS "MomoTransaction_idempotencyKey_key" ON "MomoTransaction"("idempotencyKey"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "MomoTransaction_fleetId_idx" ON "MomoTransaction"("fleetId"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "MomoTransaction_billingCycleId_idx" ON "MomoTransaction"("billingCycleId"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "MomoTransaction_status_idx" ON "MomoTransaction"("status"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "MomoTransaction_referenceId_idx" ON "MomoTransaction"("referenceId"); EXCEPTION WHEN OTHERS THEN null; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS "MomoTransaction_nextRetryAt_idx" ON "MomoTransaction"("nextRetryAt"); EXCEPTION WHEN OTHERS THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
    BEGIN
        ALTER TABLE "FleetSubscription" ADD CONSTRAINT "FleetSubscription_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN null; END;

    BEGIN
        ALTER TABLE "FleetSubscription" ADD CONSTRAINT "FleetSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN null; END;

    BEGIN
        ALTER TABLE "MomoTransaction" ADD CONSTRAINT "MomoTransaction_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN null; END;

    BEGIN
        ALTER TABLE "MomoTransaction" ADD CONSTRAINT "MomoTransaction_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN OTHERS THEN null; END;
END $$;
