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

    await this.sanitizeFleetPlans();
  }

  // Self-healing database routine to ensure FleetPlan enum values are valid
  async sanitizeFleetPlans(): Promise<void> {
    try {
      // Step 1: Direct text-based update if enum type already supports PAYG
      const updatedFleets = await this.$executeRawUnsafe(
        `UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan"::text NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');`,
      );
      const updatedTiers = await this.$executeRawUnsafe(
        `UPDATE "PricingTier" SET "planCode" = 'PAYG' WHERE "planCode"::text NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');`,
      );
      if (updatedFleets > 0 || updatedTiers > 0) {
        this.logger.warn(
          `Sanitized ${updatedFleets} Fleet + ${updatedTiers} PricingTier legacy plan records to PAYG`,
        );
      }
    } catch (err: unknown) {
      // Step 2: If Postgres enum type rejects 'PAYG', perform full enum type migration in DB
      this.logger.warn(
        `Standard Fleet plan sanitization failed (${err instanceof Error ? err.message : 'enum type mismatch'}). Performing structural DDL enum migration...`,
      );
      try {
        await this.$executeRawUnsafe(`
          ALTER TABLE "Fleet" ALTER COLUMN "plan" DROP DEFAULT;
          ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;
          ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE TEXT USING "planCode"::text;
          UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan" NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');
          UPDATE "PricingTier" SET "planCode" = 'PAYG' WHERE "planCode" NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');
          DROP TYPE IF EXISTS "FleetPlan" CASCADE;
          CREATE TYPE "FleetPlan" AS ENUM ('PAYG', 'INSURANCE', 'ENTERPRISE');
          ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE "FleetPlan" USING "plan"::"FleetPlan";
          ALTER TABLE "Fleet" ALTER COLUMN "plan" SET DEFAULT 'PAYG';
          ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE "FleetPlan" USING "planCode"::"FleetPlan";
        `);
        this.logger.log('Successfully updated PostgreSQL FleetPlan enum type and sanitized records.');
      } catch (ddlErr: unknown) {
        this.logger.error(
          `Fleet plan DDL migration failed: ${ddlErr instanceof Error ? ddlErr.message : 'unknown'}`,
        );
      }
    }
  }

  // Closes the Prisma query engine on app shutdown.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
