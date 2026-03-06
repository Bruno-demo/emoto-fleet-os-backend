import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
