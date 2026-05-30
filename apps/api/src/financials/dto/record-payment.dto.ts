import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ example: '8cf840f3-b78f-4ba9-bbf2-570a256dfdff' })
  @IsUUID()
  riderId!: string;

  @ApiProperty({ example: 15.0 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: '2026-05-30T10:00:00.000Z' })
  @IsString()
  paidAt!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PAID })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @ApiPropertyOptional({ example: 'TXN-8849310' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'Daily lease collection' })
  @IsOptional()
  @IsString()
  notes?: string;
}
