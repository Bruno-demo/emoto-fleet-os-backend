import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoiType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPoisDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PoiType, example: PoiType.SWAP })
  @IsOptional()
  @IsEnum(PoiType)
  type?: PoiType;

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @IsString()
  active?: string;

  @ApiPropertyOptional({ example: '320e8b2b-4567-4567-4567-1234567890ab' })
  @IsOptional()
  @IsUUID()
  fleetId?: string;
}
