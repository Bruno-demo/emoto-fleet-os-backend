import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class UpdateRiderDto {
  @ApiPropertyOptional({ example: 'Alice Rider' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: '+250700000111' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  phone?: string;

  @ApiPropertyOptional({ example: 'rider1@demo.emoto' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'StrongPass123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: 'R-1234567' })
  @IsOptional()
  @IsString()
  licenceNumber?: string;

  @ApiPropertyOptional({ example: '1234567890123456' })
  @IsOptional()
  @IsString()
  identityNumber?: string;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,...' })
  @IsOptional()
  @IsString()
  passportPhoto?: string;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,...' })
  @IsOptional()
  @IsString()
  licencePhoto?: string;

  @ApiPropertyOptional({ example: 'data:image/jpeg;base64,...' })
  @IsOptional()
  @IsString()
  identityCardPhoto?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  leaseToOwn?: boolean;

  @ApiPropertyOptional({ example: 2500000 })
  @IsOptional()
  @IsNumber()
  leasePrincipal?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  leaseDailyRate?: number;

  @ApiPropertyOptional({ example: 'DAILY', enum: ['DAILY', 'WEEKLY', 'CUSTOM'] })
  @IsOptional()
  @IsString()
  paymentSchedule?: 'DAILY' | 'WEEKLY' | 'CUSTOM';

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  assignedRate?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsNumber()
  customScheduleDays?: number;
}
