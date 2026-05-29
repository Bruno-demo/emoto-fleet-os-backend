import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterSelfDto {
  @ApiProperty({ example: 'Jean-Claude Niyonzima' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'owner@personal.emoto' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+250700000333' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: 'DEMO', enum: ['DEMO', 'PREMIUM'] })
  @IsOptional()
  @IsEnum(['DEMO', 'PREMIUM'])
  plan?: 'DEMO' | 'PREMIUM';
}
