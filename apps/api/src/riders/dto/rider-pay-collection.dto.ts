import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class RiderPayCollectionDto {
  @ApiPropertyOptional({
    description: 'Amount in RWF to pay (defaults to daily lease rate if omitted)',
    example: 15000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  amount?: number;

  @ApiPropertyOptional({
    description: 'MoMo phone number to charge (defaults to rider phone if omitted)',
    example: '0780000100',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|\+?250)?(78|79|72|73)\d{7}$/, {
    message: 'Phone must be a valid Rwandan mobile number (e.g., 0788123456)',
  })
  momoPhoneNumber?: string;
}
