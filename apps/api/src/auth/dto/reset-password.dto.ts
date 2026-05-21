import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
