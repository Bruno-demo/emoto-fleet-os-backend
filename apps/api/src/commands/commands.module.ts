import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SmsModule } from '../sms/sms.module';
import { CommandsController } from './commands.controller';
import { CommandsService } from './commands.service';

@Module({
  imports: [PrismaModule, RedisModule, AuditModule, EventsModule, SmsModule],
  controllers: [CommandsController],
  providers: [CommandsService],
  exports: [CommandsService],
})
export class CommandsModule {}
