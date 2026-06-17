import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycleStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListBillingCyclesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by specific fleet ID' })
  @IsOptional()
  @IsUUID()
  fleetId?: string;

  @ApiPropertyOptional({ enum: BillingCycleStatus })
  @IsOptional()
  @IsEnum(BillingCycleStatus)
  status?: BillingCycleStatus;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
