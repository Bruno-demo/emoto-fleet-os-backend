import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationPrefsDto {
  @ApiProperty()
  @IsBoolean()
  openIncidents!: boolean;

  @ApiProperty()
  @IsBoolean()
  sosAlerts!: boolean;

  @ApiProperty()
  @IsBoolean()
  crashEvents!: boolean;
}
