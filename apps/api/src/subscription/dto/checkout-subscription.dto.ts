import { ApiProperty } from '@nestjs/swagger';
import { FleetPlan } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CheckoutSubscriptionDto {
  @ApiProperty({ enum: FleetPlan })
  @IsEnum(FleetPlan)
  plan!: FleetPlan;
}
