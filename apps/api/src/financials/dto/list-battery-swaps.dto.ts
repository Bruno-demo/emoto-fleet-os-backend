import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListBatterySwapsDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  bikeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  riderId?: string;
}
