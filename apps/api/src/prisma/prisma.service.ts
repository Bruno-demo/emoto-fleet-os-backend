import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  // Connects to the database and sanitizes any legacy enum values before the app starts handling requests.
  async onModuleInit(): Promise<void> {
    await this.$connect();

    if (
      process.env.RESET_DB === 'true' ||
      process.env.WIPE_DATABASE === 'true'
    ) {
      this.logger.warn(
        'RESET_DB environment variable is set to true! Performing nuclear database reset...',
      );
      try {
        await this.$executeRawUnsafe(`DROP SCHEMA public CASCADE;`);
        await this.$executeRawUnsafe(`CREATE SCHEMA public;`);
        await this.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public;`);
        this.logger.log('Database public schema reset completed successfully.');
      } catch (err) {
        this.logger.error('Failed to reset database schema:', err);
      }
    }

    await this.sanitizeFleetPlans();
    await this.ensureSchemaColumns();
    await this.sanitizeAuditEnums();
  }

  // Self-healing database routine: convert AuditLog.actionType to TEXT to bypass enum ownership issues permanently
  async sanitizeAuditEnums(): Promise<void> {
    this.logger.log('Ensuring AuditLog.actionType is flexible TEXT column...');
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" ALTER COLUMN "actionType" TYPE TEXT USING "actionType"::text;`,
      );
    } catch (e) {
      this.logger.debug(
        `AuditLog actionType cast: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Self-healing database routine to auto-create missing schema columns on startup
  async ensureSchemaColumns(): Promise<void> {
    this.logger.log('Ensuring PostgreSQL schema columns exist (self-healing migration)...');
    try {
      await this.$executeRawUnsafe(`ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "bankName" TEXT;`);
      await this.$executeRawUnsafe(`ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;`);
      await this.$executeRawUnsafe(`ALTER TABLE "Fleet" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;`);
    } catch (err) {
      this.logger.error('Failed to ensure schema columns:', err);
    }
  }

  // Self-healing database routine to ensure FleetPlan enum values are valid
  async sanitizeFleetPlans(): Promise<void> {
    this.logger.log(
      'Executing PostgreSQL FleetPlan enum & data sanitization...',
    );

    // 1. Ensure PostgreSQL FleetPlan enum type has all schema values (PAYG, INSURANCE, ENTERPRISE)
    try {
      await this.$executeRawUnsafe(
        `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'PAYG';`,
      );
    } catch (e) {
      this.logger.debug(
        `ADD VALUE PAYG: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    try {
      await this.$executeRawUnsafe(
        `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'INSURANCE';`,
      );
    } catch (e) {
      this.logger.debug(
        `ADD VALUE INSURANCE: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    try {
      await this.$executeRawUnsafe(
        `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';`,
      );
    } catch (e) {
      this.logger.debug(
        `ADD VALUE ENTERPRISE: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // 2. Direct atomic UPDATE for Fleet table: convert any DEMO/PREMIUM/invalid text values to PAYG
    try {
      const updatedFleets = await this.$executeRawUnsafe(`
        UPDATE "Fleet" 
        SET "plan" = 'PAYG'::"FleetPlan" 
        WHERE "plan"::text NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE') OR "plan" IS NULL;
      `);
      if (updatedFleets > 0) {
        this.logger.warn(
          `Successfully migrated ${updatedFleets} Fleet records (DEMO/PREMIUM -> PAYG)`,
        );
      }
    } catch (err) {
      this.logger.debug(
        `Direct Fleet update fallback: ${err instanceof Error ? err.message : String(err)}`,
      );

      // Fallback: convert column to TEXT, update, and revert enum type
      try {
        await this.$executeRawUnsafe(
          `ALTER TABLE "Fleet" ALTER COLUMN "plan" DROP DEFAULT;`,
        );
        await this.$executeRawUnsafe(
          `ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;`,
        );
        await this.$executeRawUnsafe(
          `UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan" NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE') OR "plan" IS NULL;`,
        );
        await this.$executeRawUnsafe(
          `ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE "FleetPlan" USING "plan"::"FleetPlan";`,
        );
        await this.$executeRawUnsafe(
          `ALTER TABLE "Fleet" ALTER COLUMN "plan" SET DEFAULT 'PAYG'::"FleetPlan";`,
        );
        this.logger.log(
          'Fallback Fleet plan sanitization via TEXT cast succeeded.',
        );
      } catch (fallbackErr) {
        this.logger.error('Fleet plan sanitization error:', fallbackErr);
      }
    }

    // 3. Direct atomic UPDATE for PricingTier table if it exists
    try {
      await this.$executeRawUnsafe(`
        DELETE FROM "PricingTier" 
        WHERE "planCode"::text IN ('DEMO', 'PREMIUM') 
          AND EXISTS (SELECT 1 FROM "PricingTier" p2 WHERE p2."planCode"::text = 'PAYG');
      `);
      await this.$executeRawUnsafe(`
        UPDATE "PricingTier" 
        SET "planCode" = 'PAYG'::"FleetPlan" 
        WHERE "planCode"::text NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');
      `);
    } catch (e) {
      this.logger.debug(
        `PricingTier update skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Closes the Prisma query engine on app shutdown.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
