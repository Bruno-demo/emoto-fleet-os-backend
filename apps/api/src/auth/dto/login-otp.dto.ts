import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginOtpDto {
  @ApiProperty({ example: 'temp_login_session_e9a11...' })
  @IsString()
  @IsNotEmpty()
  tempToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;
}
