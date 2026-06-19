-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN     "bikeRange" TEXT;

-- AlterTable
ALTER TABLE "PricingTier" ALTER COLUMN "setupFeePerBike" SET DEFAULT 35000;
