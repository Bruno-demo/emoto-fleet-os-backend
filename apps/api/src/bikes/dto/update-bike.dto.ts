import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CreateBikeDto } from './create-bike.dto';

export class UpdateBikeDto extends PartialType(CreateBikeDto) {
  @ApiPropertyOptional({
    description: 'Name of the insurance company covering this bike',
    example: 'Radiant',
  })
  @IsOptional()
  insurerName?: string | null;
}
