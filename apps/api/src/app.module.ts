import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BikesModule } from './bikes/bikes.module';
import { envSchema } from './config/env.schema';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      // Validates required environment variables before booting the app.
      validate: (env) => envSchema.parse(env),
    }),
    AuthModule,
    BikesModule,
    DevicesModule,
    PrismaModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
