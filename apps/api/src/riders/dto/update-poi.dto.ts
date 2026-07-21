import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoiType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsArray,
} from 'class-validator';

export class UpdatePoiDto {
  @ApiPropertyOptional({ enum: PoiType })
  @IsOptional()
  @IsEnum(PoiType)
  type?: PoiType;

  @ApiPropertyOptional({ example: 'Updated Garage Name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '+250700123999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: -1.944 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 30.061 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: 'KG 11 Ave, Kigali' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: ['SPIRO', 'AMPARSAND'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedBikeTypes?: string[];

  @ApiPropertyOptional({
    example: 2500,
    description: 'Full battery swap fee in RWF',
  })
  @IsOptional()
  @IsNumber()
  fullSwapFeeRwf?: number;

  @ApiPropertyOptional({
    example: 1250,
    description: 'Half battery swap fee in RWF',
  })
  @IsOptional()
  @IsNumber()
  halfSwapFeeRwf?: number;

  @ApiPropertyOptional({
    example: 625,
    description: 'Quarter battery swap fee in RWF',
  })
  @IsOptional()
  @IsNumber()
  quarterSwapFeeRwf?: number;
}
