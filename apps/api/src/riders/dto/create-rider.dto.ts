import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateRiderDto {
  @ApiProperty({ example: 'Alice Rider' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: '0788123456' })
  @IsString()
  @MinLength(6)
  phone!: string;

  @ApiPropertyOptional({ example: 'rider1@demo.emoto' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: '57df4ef2-909d-45f9-8e4a-0cbf821adfaa',
    description: 'Optional bike assignment created atomically with rider',
  })
  @IsOptional()
  @IsUUID()
  assignBikeId?: string;

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
}
