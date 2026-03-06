import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ example: '57df4ef2-909d-45f9-8e4a-0cbf821adfaa' })
  @IsUUID()
  bikeId!: string;

  @ApiProperty({ example: '35de84ab-b5f0-4e50-a15f-6f859db76c88' })
  @IsUUID()
  riderUserId!: string;
}
