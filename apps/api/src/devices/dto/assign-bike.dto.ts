import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignBikeDto {
  @ApiProperty({ example: '5d8eb8a0-2002-4fda-8f15-b5f3eeecf888' })
  @IsUUID()
  bikeId!: string;
}
