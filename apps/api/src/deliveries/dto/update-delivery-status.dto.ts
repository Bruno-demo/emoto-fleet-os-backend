import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: DeliveryStatus })
  @IsEnum(DeliveryStatus)
  @IsNotEmpty()
  status!: DeliveryStatus;

  @ApiPropertyOptional({ example: 'Customer not responding' })
  @IsString()
  @IsOptional()
  failureReason?: string;

  @ApiPropertyOptional({ example: 'https://storage.example/proof.jpg' })
  @IsString()
  @IsOptional()
  proofPhotoUrl?: string;

  @ApiPropertyOptional({ example: 'data:image/png;base64,...' })
  @IsString()
  @IsOptional()
  proofSignature?: string;

  @ApiPropertyOptional({ example: 'Left package with security guard' })
  @IsString()
  @IsOptional()
  notes?: string;
}
