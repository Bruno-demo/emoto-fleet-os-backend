import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ZoneType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ example: 'Downtown Slow Zone' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ZoneType, example: ZoneType.SLOW })
  @IsEnum(ZoneType)
  type!: ZoneType;

  @ApiProperty({
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [30.05, -1.95],
          [30.07, -1.95],
          [30.07, -1.93],
          [30.05, -1.93],
          [30.05, -1.95],
        ],
      ],
    },
  })
  @IsObject()
  geojsonPolygon!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  speedLimitKph?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
