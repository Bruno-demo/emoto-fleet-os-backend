import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsUUID, IsDateString } from 'class-validator';

export class CreateTrafficFineDto {
  @ApiProperty({ example: 'f3b8b17b-bc43-4ce4-8cb2-e3e9681087e1' })
  @IsUUID()
  @IsNotEmpty()
  riderId!: string;

  @ApiProperty({ example: 25000 })
  @IsInt()
  amount!: number;

  @ApiProperty({ example: 'Speeding on KG 7 Ave' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ example: 'TKT-987654' })
  @IsString()
  @IsNotEmpty()
  ticketNumber!: string;

  @ApiProperty({ example: '2026-07-17T00:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  finedAt!: string;
}
