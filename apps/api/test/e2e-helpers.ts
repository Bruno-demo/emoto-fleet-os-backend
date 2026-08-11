import { PrismaClient } from '@prisma/client';

export async function ensureTestSchemaSync(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'PAYG';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'INSURANCE';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_REQUESTED';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RECEIVED';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_FAILED';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RETRIED';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CREATED';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED';`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED';`);
  } catch {
    // Ignore error if enums already exist
  }
}
