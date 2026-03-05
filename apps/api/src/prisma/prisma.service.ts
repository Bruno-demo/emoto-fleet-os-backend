import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Closes the Prisma query engine on app shutdown.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
