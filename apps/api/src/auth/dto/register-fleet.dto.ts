import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterFleetDto {
  @ApiProperty({ example: 'Kigali Express Fleet' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fleetName!: string;

  @ApiProperty({
    example: '11-50',
    description: 'Approximate fleet size range',
  })
  @IsString()
  @IsIn(['1-10', '11-50', '51-200', '201-500', '500+'])
  bikeRange!: string;

  @ApiPropertyOptional({ example: 'admin@fleet.example' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+250700000111' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ['DEMO', 'PREMIUM'] })
  @IsIn(['DEMO', 'PREMIUM'])
  plan!: 'DEMO' | 'PREMIUM';
}
