import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateBikeDto } from './create-bike.dto';

export class UpdateBikeDto extends PartialType(CreateBikeDto) {
  @ApiPropertyOptional({
    description: 'UUID of an insurer user to link to this bike',
    example: '5d8eb8a0-2002-4fda-8f15-b5f3eeecf888',
  })
  @IsOptional()
  @IsUUID()
  insurerUserId?: string | null;
}
