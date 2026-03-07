import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class RiderEventsQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-07T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 50, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: '5f3d7d2e-8f4f-4f95-9e63-f4e4c7db86d1',
    description:
      'Optional assigned bike filter. If omitted, service uses latest active assignment.',
  })
  @IsOptional()
  @IsUUID()
  bikeId?: string;
}
