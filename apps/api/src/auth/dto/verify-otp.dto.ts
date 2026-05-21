import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { OtpReason } from './send-otp.dto';

export class VerifyOtpDto {
  @ApiProperty({ example: 'operator@fleet.example' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;

  @ApiProperty({ enum: OtpReason, example: OtpReason.REGISTER })
  @IsEnum(OtpReason)
  @IsNotEmpty()
  reason!: 'register' | 'login';
}
