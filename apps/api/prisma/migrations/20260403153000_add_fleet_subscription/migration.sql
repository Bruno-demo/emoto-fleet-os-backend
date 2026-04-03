-- CreateEnum
CREATE TYPE "FleetPlan" AS ENUM ('DEMO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "FleetSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN "plan" "FleetPlan" NOT NULL DEFAULT 'DEMO';
ALTER TABLE "Fleet" ADD COLUMN "subscriptionStatus" "FleetSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';
