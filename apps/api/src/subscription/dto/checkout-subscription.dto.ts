import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FleetPlan } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CheckoutSubscriptionDto {
  @ApiProperty({ enum: FleetPlan })
  @IsEnum(FleetPlan)
  plan!: FleetPlan;

  @ApiPropertyOptional({
    description:
      'MTN Mobile Money phone number (e.g. 0781234567 or 250781234567)',
  })
  @IsOptional()
  @IsString()
  momoPhoneNumber?: string;
}
