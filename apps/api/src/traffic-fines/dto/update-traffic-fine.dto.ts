import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString, IsIn } from 'class-validator';

export class UpdateTrafficFineDto {
  @ApiPropertyOptional({ example: 25000 })
  @IsInt()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ example: 'Speeding on KG 7 Ave' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: 'TKT-987654' })
  @IsString()
  @IsOptional()
  ticketNumber?: string;

  @ApiPropertyOptional({ example: 'PAID' })
  @IsString()
  @IsIn(['PENDING', 'PAID', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: '2026-07-17T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  finedAt?: string;

  @ApiPropertyOptional({ example: '2026-07-17T12:00:00Z' })
  @IsDateString()
  @IsOptional()
  paidAt?: string;
}
