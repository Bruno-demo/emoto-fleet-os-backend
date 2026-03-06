import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoiType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePoiDto {
  @ApiProperty({ enum: PoiType, example: PoiType.GARAGE })
  @IsEnum(PoiType)
  type!: PoiType;

  @ApiProperty({ example: 'City Garage - Nyamirambo' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '+250700123999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ example: -1.944 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 30.061 })
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ example: 'KG 11 Ave, Kigali' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Set true to create a global POI (fleetId=null). Only OWNER is allowed.',
  })
  @IsOptional()
  @IsBoolean()
  global?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
