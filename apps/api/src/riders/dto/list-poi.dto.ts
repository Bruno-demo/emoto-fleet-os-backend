import { ApiPropertyOptional } from '@nestjs/swagger';
import { PoiType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPoiDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PoiType, example: PoiType.GARAGE })
  @IsOptional()
  @IsEnum(PoiType)
  type?: PoiType;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}
