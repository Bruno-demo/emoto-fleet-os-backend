-- Migrate FleetPlan enum type and legacy DB records from DEMO/PREMIUM to PAYG/INSURANCE/ENTERPRISE

-- 1. Drop default on Fleet.plan
ALTER TABLE "Fleet" ALTER COLUMN "plan" DROP DEFAULT;

-- 2. Convert enum columns to TEXT temporarily
ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;
ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE TEXT USING "planCode"::text;

-- 3. Update legacy values in Fleet table
UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan" IN ('DEMO', 'PREMIUM');

-- 4. Clean up legacy values in PricingTier table without violating unique constraints
DELETE FROM "PricingTier" WHERE "planCode" IN ('DEMO', 'PREMIUM') AND EXISTS (SELECT 1 FROM "PricingTier" WHERE "planCode" = 'PAYG');
UPDATE "PricingTier" SET "planCode" = 'PAYG' WHERE "planCode" IN ('DEMO', 'PREMIUM');

-- 5. Recreate FleetPlan enum with new allowed values
DROP TYPE "FleetPlan";
CREATE TYPE "FleetPlan" AS ENUM ('PAYG', 'INSURANCE', 'ENTERPRISE');

-- 6. Cast columns back to FleetPlan enum and restore default
ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE "FleetPlan" USING "plan"::"FleetPlan";
ALTER TABLE "Fleet" ALTER COLUMN "plan" SET DEFAULT 'PAYG';

ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE "FleetPlan" USING "planCode"::"FleetPlan";

