import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RiderSosDto {
  @ApiPropertyOptional({ example: 'Bike broke down near Kimironko.' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({ example: -1.944 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  lat?: number;

  @ApiPropertyOptional({ example: 30.061 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
