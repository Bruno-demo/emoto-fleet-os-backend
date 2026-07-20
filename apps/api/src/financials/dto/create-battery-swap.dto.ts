import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum SwapTypeEnum {
  FULL = 'FULL',
  HALF = 'HALF',
  QUARTER = 'QUARTER',
  CUSTOM = 'CUSTOM',
}

export class CreateBatterySwapDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  bikeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  riderId?: string;

  @ApiProperty({ required: false, default: 'Kigali Central Hub' })
  @IsOptional()
  @IsString()
  swapStation?: string;

  @ApiProperty({ enum: SwapTypeEnum, default: SwapTypeEnum.FULL })
  @IsEnum(SwapTypeEnum)
  swapType!: SwapTypeEnum;

  @ApiProperty({ required: false, default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.05)
  @Max(2.0)
  fraction?: number;

  @ApiProperty({ required: false, default: 2500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPriceRwf?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batterySerialOut?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batterySerialIn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  soCOutPct?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  soCInPct?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ts?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
