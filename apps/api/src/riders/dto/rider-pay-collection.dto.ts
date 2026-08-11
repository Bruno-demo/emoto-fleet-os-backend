import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class RiderPayCollectionDto {
  @ApiPropertyOptional({
    description:
      'Amount in RWF to pay (defaults to daily lease rate if omitted)',
    example: 15000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  amount?: number;

  @ApiPropertyOptional({
    description:
      'MoMo phone number to charge (defaults to rider phone if omitted)',
    example: '0780000100',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|\+?250)?(78|79|72|73)\d{7}$/, {
    message: 'Phone must be a valid Rwandan mobile number (e.g., 0788123456)',
  })
  momoPhoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Whether this payment is a partial payment',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPartial?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for partial payment (required if isPartial is true)',
    example: 'Bike was undergoing maintenance in morning',
  })
  @IsOptional()
  @IsString()
  partialReason?: string;
}
