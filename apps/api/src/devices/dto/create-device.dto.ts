import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ example: 'DEV-10001' })
  @IsString()
  @MaxLength(120)
  deviceUid!: string;

  @ApiPropertyOptional({ example: '863211040000001' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  imei?: string;

  @ApiPropertyOptional({ example: 'v1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fwVersion?: string;
}
