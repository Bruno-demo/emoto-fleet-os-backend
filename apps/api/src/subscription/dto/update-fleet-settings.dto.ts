import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateFleetSettingsDto {
  @ApiPropertyOptional({
    description:
      'Fleet Mobile Money phone number for receiving rider collection payments',
    example: '0788123456',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(07[2389]\d{7}|2507[2389]\d{7})$/, {
    message:
      'Mobile Money phone number must be a valid Rwandan phone number (e.g., 0788123456 or 250788123456)',
  })
  momoPhoneNumber?: string;
}
