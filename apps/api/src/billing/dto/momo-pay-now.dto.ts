import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class MomoPayNowDto {
  @ApiPropertyOptional({
    description: 'MoMo phone number to charge. Uses fleet default if omitted.',
    example: '0781234567',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|\+?250)?(78|79|72|73)\d{7}$/, {
    message: 'Phone must be a valid Rwandan mobile number (e.g., 0781234567)',
  })
  momoPhoneNumber?: string;
}
