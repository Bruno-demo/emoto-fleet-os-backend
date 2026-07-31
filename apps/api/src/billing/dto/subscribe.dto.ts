import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlanDuration } from '@prisma/client';
import {
  IsEnum,
  IsString,
  Matches,
} from 'class-validator';

export class SubscribeDto {
  @ApiProperty({
    enum: SubscriptionPlanDuration,
    description: 'Subscription plan duration',
    example: 'ANNUAL',
  })
  @IsEnum(SubscriptionPlanDuration)
  planDuration!: SubscriptionPlanDuration;

  @ApiProperty({
    description: 'MoMo phone number for auto-payments',
    example: '0781234567',
  })
  @IsString()
  @Matches(/^(0|\+?250)?(78|79|72|73)\d{7}$/, {
    message: 'Phone must be a valid Rwandan mobile number (e.g., 0781234567)',
  })
  momoPhoneNumber!: string;
}
