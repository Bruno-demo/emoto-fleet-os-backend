import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RoadsController } from './roads.controller';
import { RoadFeaturesService } from './roads.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [RoadsController],
  providers: [RoadFeaturesService],
  exports: [RoadFeaturesService],
})
export class RoadsModule {}
