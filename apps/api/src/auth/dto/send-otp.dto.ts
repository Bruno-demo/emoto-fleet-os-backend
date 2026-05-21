import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum OtpReason {
  REGISTER = 'register',
  LOGIN = 'login',
}

export class SendOtpDto {
  @ApiProperty({ example: 'operator@fleet.example' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ enum: OtpReason, example: OtpReason.REGISTER })
  @IsEnum(OtpReason)
  @IsNotEmpty()
  reason!: 'register' | 'login';
}
