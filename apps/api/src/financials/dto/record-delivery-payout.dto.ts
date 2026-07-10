import { IsUUID, IsNotEmpty } from 'class-validator';

export class RecordDeliveryPayoutDto {
  @IsUUID()
  @IsNotEmpty()
  riderId!: string;
}
