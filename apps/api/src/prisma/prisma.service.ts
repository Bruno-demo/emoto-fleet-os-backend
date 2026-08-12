import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  // Automatically cleans up any legacy database records on startup before queries run.
  async onModuleInit(): Promise<void> {
    try {
      const updatedCount = await this.$executeRawUnsafe(
        `UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan"::text IN ('DEMO', 'PREMIUM');`,
      );
      if (updatedCount > 0) {
        this.logger.log(`Sanitized ${updatedCount} legacy fleet plan records to PAYG`);
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
