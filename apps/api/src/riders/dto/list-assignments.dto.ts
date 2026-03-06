import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAssignmentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '57df4ef2-909d-45f9-8e4a-0cbf821adfaa' })
  @IsOptional()
  @IsUUID()
  bikeId?: string;

  @ApiPropertyOptional({ example: '35de84ab-b5f0-4e50-a15f-6f859db76c88' })
  @IsOptional()
  @IsUUID()
  riderUserId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}
