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

    // Immediately sanitize legacy FleetPlan enum values (DEMO, PREMIUM) that were removed
    // from the Prisma schema. This MUST run before any Prisma query attempts to deserialize
    // Fleet rows, otherwise findFirst/findMany will throw:
    //   "Value 'DEMO' not found in enum 'FleetPlan'"
    try {
      const updatedFleets = await this.$executeRawUnsafe(
        `UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan"::text IN ('DEMO', 'PREMIUM');`,
      );
      const updatedTiers = await this.$executeRawUnsafe(
        `UPDATE "PricingTier" SET "planCode" = 'PAYG' WHERE "planCode"::text IN ('DEMO', 'PREMIUM');`,
      );
      if (updatedFleets > 0 || updatedTiers > 0) {
        this.logger.warn(
          `Sanitized ${updatedFleets} Fleet + ${updatedTiers} PricingTier legacy plan records (DEMO/PREMIUM → PAYG)`,
        );
      }
    } catch (err: unknown) {
      this.logger.debug(
        `Fleet plan sanitization skipped: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  // Closes the Prisma query engine on app shutdown.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
