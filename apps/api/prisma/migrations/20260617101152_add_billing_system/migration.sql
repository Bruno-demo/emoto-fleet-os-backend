-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "DiscountTarget" AS ENUM ('SETUP_FEE', 'SUBSCRIPTION', 'BOTH');

-- CreateEnum
CREATE TYPE "BillingCycleStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELED', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'BILLING_CYCLE_GENERATED';
ALTER TYPE "AuditActionType" ADD VALUE 'BILLING_PAYMENT_RECORDED';
ALTER TYPE "AuditActionType" ADD VALUE 'BILLING_OVERDUE_MARKED';
ALTER TYPE "AuditActionType" ADD VALUE 'BILLING_REMINDER_SENT';
ALTER TYPE "AuditActionType" ADD VALUE 'DISCOUNT_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'DISCOUNT_UPDATED';
ALTER TYPE "AuditActionType" ADD VALUE 'PRICING_TIER_UPDATED';
ALTER TYPE "AuditActionType" ADD VALUE 'BILLING_CONFIG_UPDATED';
ALTER TYPE "AuditActionType" ADD VALUE 'TRIAL_STARTED';
ALTER TYPE "AuditActionType" ADD VALUE 'TRIAL_EXPIRED';

-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN     "billingStartedAt" TIMESTAMPTZ(6),
ADD COLUMN     "trialEndsAt" TIMESTAMPTZ(6),
ADD COLUMN     "trialStartedAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "planCode" "FleetPlan" NOT NULL,
    "monthlyRatePerBike" INTEGER NOT NULL,
    "setupFeePerBike" INTEGER NOT NULL DEFAULT 30000,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "appliesTo" "DiscountTarget" NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMPTZ(6),
    "validUntil" TIMESTAMPTZ(6),
    "fleetId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingConfig" (
    "id" UUID NOT NULL,
    "billingCycleDays" INTEGER NOT NULL DEFAULT 30,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "trialEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trialDurationDays" INTEGER NOT NULL DEFAULT 14,
    "upcomingReminderDays" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "overdueReminderDays" INTEGER[] DEFAULT ARRAY[1, 3, 7]::INTEGER[],
    "currencyCode" TEXT NOT NULL DEFAULT 'RWF',
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCycle" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "dueDate" TIMESTAMPTZ(6) NOT NULL,
    "bikeCount" INTEGER NOT NULL,
    "ratePerBike" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalDue" INTEGER NOT NULL,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,
    "status" "BillingCycleStatus" NOT NULL DEFAULT 'PENDING',
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "discountId" UUID,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" UUID NOT NULL,
    "billingCycleId" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" UUID NOT NULL,
    "paidAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingTier_planCode_key" ON "PricingTier"("planCode");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_code_key" ON "Discount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCycle_fleetId_cycleNumber_key" ON "BillingCycle"("fleetId", "cycleNumber");

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
