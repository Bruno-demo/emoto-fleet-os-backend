import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignDeliveryDto {
  @ApiProperty({ example: 'a123bc45-de67-89fa-bcde-f123456789ab' })
  @IsUUID()
  @IsNotEmpty()
  riderId!: string;
}
