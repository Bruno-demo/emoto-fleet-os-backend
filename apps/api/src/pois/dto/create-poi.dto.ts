import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoiType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePoiDto {
  @ApiPropertyOptional({ example: '320e8b2b-4567-4567-4567-1234567890ab' })
  @IsOptional()
  @IsUUID()
  fleetId?: string;

  @ApiProperty({ enum: PoiType, example: PoiType.SWAP })
  @IsEnum(PoiType)
  type!: PoiType;

  @ApiProperty({ example: 'Batsinda Mega-swap Station' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: -1.911532 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 30.085955 })
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ example: 'KG 818 St, Kigali, Gasabo' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: ['SPIRO', 'E_MOTO'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedBikeTypes?: string[];

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber()
  fullSwapFeeRwf?: number;

  @ApiPropertyOptional({ example: 1250 })
  @IsOptional()
  @IsNumber()
  halfSwapFeeRwf?: number;

  @ApiPropertyOptional({ example: 625 })
  @IsOptional()
  @IsNumber()
  quarterSwapFeeRwf?: number;
}
