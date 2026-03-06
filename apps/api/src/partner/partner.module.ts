import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerAuthController } from './partner-auth.controller';
import { PartnerAuthGuard } from './partner-auth.guard';
import { PartnerAuthService } from './partner-auth.service';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    IncidentsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      // Configures dedicated JWT signing for insurer partner tokens.
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('PARTNER_JWT_SECRET'),
      }),
    }),
  ],
  controllers: [PartnerAuthController, PartnerController],
  providers: [PartnerAuthService, PartnerAuthGuard, PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
