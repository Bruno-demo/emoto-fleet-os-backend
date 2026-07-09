import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDeliveryDto {
  @ApiProperty({ example: 'ORD-12345' })
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @ApiProperty({ example: 'Kigali Heights, KG 7 Ave' })
  @IsString()
  @IsNotEmpty()
  pickupAddress!: string;

  @ApiProperty({ example: -1.9441 })
  @IsNumber()
  pickupLat!: number;

  @ApiProperty({ example: 30.0899 })
  @IsNumber()
  pickupLng!: number;

  @ApiProperty({ example: 'Nyabugogo Bus Station' })
  @IsString()
  @IsNotEmpty()
  dropoffAddress!: string;

  @ApiProperty({ example: -1.9398 })
  @IsNumber()
  dropoffLat!: number;

  @ApiProperty({ example: 30.0532 })
  @IsNumber()
  dropoffLng!: number;

  @ApiProperty({ example: 'Marie Claire' })
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @ApiProperty({ example: '+250788888888' })
  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @ApiPropertyOptional({ example: 'Leave at front desk' })
  @IsString()
  @IsOptional()
  notes?: string;
}
