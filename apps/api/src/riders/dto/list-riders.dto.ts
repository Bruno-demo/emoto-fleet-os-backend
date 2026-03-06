import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListRidersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '57df4ef2-909d-45f9-8e4a-0cbf821adfaa',
    description: 'Optional filter by currently assigned bike id',
  })
  @IsOptional()
  @IsUUID()
  bikeId?: string;
}
