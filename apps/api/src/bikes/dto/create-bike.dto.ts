import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BikeStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class CreateBikeDto {
  @ApiProperty({ example: 'Bike-010' })
  @IsString()
  @MaxLength(80)
  label!: string;

  @ApiPropertyOptional({ example: 'RAB123C' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  plate?: string;

  @ApiPropertyOptional({ example: 'SER-000010' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serial?: string;

  @ApiPropertyOptional({ example: 'eMoto-X2' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional({ enum: BikeStatus, example: BikeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BikeStatus)
  status?: BikeStatus;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,...' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'SPIRO',
    enum: ['SPIRO', 'AMPARSAND', 'AMAZI'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['SPIRO', 'AMPARSAND', 'AMAZI'])
  type?: string;

  @ApiPropertyOptional({ example: 'Radiant', nullable: true })
  @IsOptional()
  @IsString()
  insurerName?: string | null;
}
