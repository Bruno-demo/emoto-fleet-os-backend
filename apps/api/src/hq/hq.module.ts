import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommandsModule } from '../commands/commands.module';
import { HqController } from './hq.controller';
import { HqService } from './hq.service';

@Module({
  imports: [PrismaModule, AuthModule, CommandsModule],
  controllers: [HqController],
  providers: [HqService],
})
export class HqModule {}
