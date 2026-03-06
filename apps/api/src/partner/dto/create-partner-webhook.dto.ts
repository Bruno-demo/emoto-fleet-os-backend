import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreatePartnerWebhookDto {
  @ApiProperty({ example: 'https://insurer.example.com/webhooks/emoto' })
  @IsString()
  @IsUrl({
    protocols: ['https'],
    require_tld: true,
    require_protocol: true,
  })
  @MaxLength(1024)
  url!: string;

  @ApiPropertyOptional({
    example: 'replace-with-secret',
    description: 'Optional custom secret; generated when omitted',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  secret?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
