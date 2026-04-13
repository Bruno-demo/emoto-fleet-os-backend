import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Blocks webhook URLs pointing at private/internal network addresses to prevent SSRF.
@ValidatorConstraint({ name: 'noPrivateHost', async: false })
class NoPrivateHostConstraint implements ValidatorConstraintInterface {
  private readonly blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^fc00:/i,
    /^fd/i,
    /^fe80:/i,
    /^::1$/,
    /\.local$/i,
    /\.internal$/i,
    /\.localhost$/i,
  ];

  validate(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return !this.blockedPatterns.some((pattern) => pattern.test(hostname));
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'Webhook URL must not point to a private or internal network address';
  }
}

export class CreatePartnerWebhookDto {
  @ApiProperty({ example: 'https://insurer.example.com/webhooks/emoto' })
  @IsString()
  @IsUrl({
    protocols: ['https'],
    require_tld: true,
    require_protocol: true,
  })
  @Validate(NoPrivateHostConstraint)
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
