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
    // 1. Add new enum values to PostgreSQL FleetPlan enum type if it exists
    try {
      await this.$executeRawUnsafe(
        `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'PAYG';`,
      );
    } catch {}
    try {
      await this.$executeRawUnsafe(
        `ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';`,
      );
    } catch {}

    // 2. Drop default constraint and convert Fleet.plan to TEXT temporarily
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "Fleet" ALTER COLUMN "plan" DROP DEFAULT;`,
      );
      await this.$executeRawUnsafe(
        `ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;`,
      );
    } catch {}

    // 3. Convert PricingTier.planCode to TEXT temporarily if table exists
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE TEXT USING "planCode"::text;`,
      );
    } catch {}

    // 4. Update all invalid/legacy text values to PAYG in Fleet table
    try {
      const updatedFleets = await this.$executeRawUnsafe(
        `UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan" NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE') OR "plan" IS NULL;`,
      );
      if (updatedFleets > 0) {
        this.logger.log(`Sanitized ${updatedFleets} Fleet records to PAYG`);
      }
    } catch {}

    // 5. Update PricingTier if table exists
    try {
      await this.$executeRawUnsafe(
        `UPDATE "PricingTier" SET "planCode" = 'PAYG' WHERE "planCode" NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');`,
      );
    } catch {}

    // 6. Recreate FleetPlan enum type in Postgres matching current schema.prisma
    try {
      await this.$executeRawUnsafe(`DROP TYPE IF EXISTS "FleetPlan" CASCADE;`);
      await this.$executeRawUnsafe(
        `CREATE TYPE "FleetPlan" AS ENUM ('PAYG', 'INSURANCE', 'ENTERPRISE');`,
      );
    } catch {}

    // 7. Cast Fleet.plan back to FleetPlan enum and restore default
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE "FleetPlan" USING "plan"::"FleetPlan";`,
      );
      await this.$executeRawUnsafe(
        `ALTER TABLE "Fleet" ALTER COLUMN "plan" SET DEFAULT 'PAYG'::"FleetPlan";`,
      );
    } catch {}

    // 8. Cast PricingTier.planCode back to FleetPlan enum if table exists
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE "FleetPlan" USING "planCode"::"FleetPlan";`,
      );
    } catch {}
  }

  // Closes the Prisma query engine on app shutdown.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
