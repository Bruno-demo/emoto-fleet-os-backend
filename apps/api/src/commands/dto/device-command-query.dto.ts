import { IsUUID } from 'class-validator';

export class DeviceCommandQueryDto {
  @IsUUID()
  bikeId!: string;
}
