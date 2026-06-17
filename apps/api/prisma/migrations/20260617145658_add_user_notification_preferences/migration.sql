-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifCrashEvents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifOpenIncidents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifSosAlerts" BOOLEAN NOT NULL DEFAULT true;
