import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventSeverity } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListEventsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-03-05T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-05T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 'OVERSPEED' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @ApiPropertyOptional({ enum: EventSeverity, example: EventSeverity.HIGH })
  @IsOptional()
  @IsEnum(EventSeverity)
  severity?: EventSeverity;

  @ApiPropertyOptional({
    example: '5d8eb8a0-2002-4fda-8f15-b5f3eeecf888',
  })
  @IsOptional()
  @IsUUID()
  bikeId?: string;

  @ApiPropertyOptional({
    example: '5d8eb8a0-2002-4fda-8f15-b5f3eeecf889',
  })
  @IsOptional()
  @IsUUID()
  deviceId?: string;
}
