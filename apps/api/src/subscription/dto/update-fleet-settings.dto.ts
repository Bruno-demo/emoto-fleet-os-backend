import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateFleetSettingsDto {
  @ApiPropertyOptional({
    description:
      'Fleet Mobile Money phone number (MTN or Airtel/Tigo) for receiving rider collection payments',
    example: '0788123456',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(07[2389]\d{7}|2507[2389]\d{7})$/, {
    message:
      'Mobile Money phone number must be a valid Rwandan phone number (e.g., 0788123456, 0738123456, or 250788123456)',
  })
  momoPhoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Fleet receiving Bank Name (e.g. Bank of Kigali, I&M, Equity)',
    example: 'Bank of Kigali',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Fleet receiving Bank Account Number',
    example: '0004003202014',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({
    description: 'Fleet receiving Bank Account Name',
    example: 'eMoto Fleet Admin Ltd',
  })
  @IsOptional()
  @IsString()
  bankAccountName?: string;
}
