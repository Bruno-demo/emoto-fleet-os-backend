import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoadFeatureType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RoadFeaturesQueryDto {
  @ApiProperty({
    description: 'Bounding box formatted as minLat,minLng,maxLat,maxLng',
    example: '-1.95,30.05,-1.90,30.10',
  })
  @IsString()
  bbox!: string;

  @ApiPropertyOptional({
    description: 'Optional feature types, comma-separated',
    isArray: true,
    enum: RoadFeatureType,
  })
  @IsOptional()
  @IsEnum(RoadFeatureType, { each: true })
  // Splits comma-separated values into the enum array expected by the service.
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((item) => item.trim())
      : value,
  )
  types?: RoadFeatureType[];
}
