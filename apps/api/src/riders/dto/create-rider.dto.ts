import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateRiderDto {
  @ApiProperty({ example: 'Alice Rider' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: '+250700000111' })
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
}
