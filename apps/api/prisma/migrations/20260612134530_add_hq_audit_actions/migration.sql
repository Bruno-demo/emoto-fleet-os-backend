-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'FLEET_PLAN_CHANGED';
ALTER TYPE "AuditActionType" ADD VALUE 'FLEET_SUBSCRIPTION_CHANGED';
ALTER TYPE "AuditActionType" ADD VALUE 'FLEET_DELETED';
ALTER TYPE "AuditActionType" ADD VALUE 'BIKE_STATUS_CHANGED';
ALTER TYPE "AuditActionType" ADD VALUE 'DEVICE_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'DEVICE_BIKE_ASSIGNMENT_CHANGED';
ALTER TYPE "AuditActionType" ADD VALUE 'PARTNER_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'WEBHOOK_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'WEBHOOK_UPDATED';
ALTER TYPE "AuditActionType" ADD VALUE 'WEBHOOK_DELETED';
ALTER TYPE "AuditActionType" ADD VALUE 'INSTALLATION_PAYMENT_TOGGLED';
ALTER TYPE "AuditActionType" ADD VALUE 'UPGRADE_APPROVED';
