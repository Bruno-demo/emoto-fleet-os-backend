import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateDeliveryDto } from '../../deliveries/dto/create-delivery.dto';

export class CreatePartnerDeliveryDto extends CreateDeliveryDto {
  @ApiProperty({ example: '8f8b14ee-33f8-4eb2-8cef-e00df972762f' })
  @IsUUID()
  fleetId!: string;
}
