import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IncidentStatusActionDto {
  @ApiPropertyOptional({
    example: 'Dispatcher acknowledged and sent assistance',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
