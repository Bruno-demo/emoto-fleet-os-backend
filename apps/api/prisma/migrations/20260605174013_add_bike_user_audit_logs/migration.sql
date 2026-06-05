-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'BIKE_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'BIKE_UPDATED';
ALTER TYPE "AuditActionType" ADD VALUE 'BIKE_DELETED';
ALTER TYPE "AuditActionType" ADD VALUE 'USER_ROLE_CHANGED';
ALTER TYPE "AuditActionType" ADD VALUE 'USER_INVITED';
