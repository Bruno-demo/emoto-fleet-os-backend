import { PrismaClient } from '@prisma/client';

export async function ensureTestSchemaSync(
  prisma: PrismaClient,
): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || '';
  const isProdEnv = process.env.NODE_ENV === 'production';
  const isRemoteDb =
    !dbUrl.includes('localhost') &&
    !dbUrl.includes('127.0.0.1') &&
    !dbUrl.includes('host.docker.internal');
  const isProdDbHost =
    dbUrl.includes('46.225.124.225') ||
    dbUrl.includes('emoto_app') ||
    dbUrl.includes('sslmode=require');

  if (isProdEnv || isRemoteDb || isProdDbHost) {
    throw new Error(
      '⛔ FATAL: E2E tests are strictly prohibited from executing against a production or remote database!',
    );
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'PAYG';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'INSURANCE';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_REQUESTED';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RECEIVED';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_FAILED';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'MOMO_PAYMENT_RETRIED';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CREATED';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED';`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED';`,
    );
  } catch {
    // Ignore error if enums already exist
  }
}
