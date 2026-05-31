-- AlterTable
ALTER TABLE "Fleet" ADD COLUMN     "installationPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "upgradeRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "upgradeRequestedAt" TIMESTAMPTZ(6);
