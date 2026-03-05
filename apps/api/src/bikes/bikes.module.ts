import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BikesController } from './bikes.controller';
import { BikesService } from './bikes.service';

@Module({
  imports: [PrismaModule],
  controllers: [BikesController],
  providers: [BikesService],
})
export class BikesModule {}
