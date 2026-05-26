import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class PublicRegisterDto {
  @ApiProperty({ example: '2f2c0a62-8c9a-4a9b-9a6b-10d72d4b1f4b' })
  @IsUUID()
  fleetId!: string;

  @ApiPropertyOptional({ example: 'rider@demo.emoto' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+250700000222' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
