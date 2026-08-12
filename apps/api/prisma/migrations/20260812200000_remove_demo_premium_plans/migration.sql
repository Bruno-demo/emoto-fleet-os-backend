-- Migrate stale FleetPlan enum values DEMO and PREMIUM to PAYG
-- These values were removed from the Prisma enum but still exist in some database rows.

-- Step 1: Update any Fleet rows that still reference DEMO or PREMIUM
UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan" IN ('DEMO', 'PREMIUM');

-- Step 2: Update any PricingTier rows that reference DEMO or PREMIUM
UPDATE "PricingTier" SET "planCode" = 'PAYG' WHERE "planCode" IN ('DEMO', 'PREMIUM');
