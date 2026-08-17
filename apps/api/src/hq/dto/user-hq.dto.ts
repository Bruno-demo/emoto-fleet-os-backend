import {
  IsEmail,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

export class CreateUserHqDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  passportPhoto?: string;

  @IsOptional()
  @IsString()
  licenceNumber?: string;

  @IsOptional()
  @IsString()
  identityNumber?: string;

  @IsOptional()
  @IsString()
  licencePhoto?: string;

  @IsOptional()
  @IsString()
  identityCardPhoto?: string;

  @IsOptional()
  @IsBoolean()
  leaseToOwn?: boolean;

  @IsOptional()
  @IsNumber()
  leasePrincipal?: number;

  @IsOptional()
  @IsNumber()
  leaseDailyRate?: number;

  @IsOptional()
  @IsNumber()
  leaseDownPayment?: number;
}

export class UpdateUserHqDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  passportPhoto?: string;

  @IsOptional()
  @IsString()
  licenceNumber?: string;

  @IsOptional()
  @IsString()
  identityNumber?: string;

  @IsOptional()
  @IsString()
  licencePhoto?: string;

  @IsOptional()
  @IsString()
  identityCardPhoto?: string;

  @IsOptional()
  @IsBoolean()
  leaseToOwn?: boolean;

  @IsOptional()
  @IsNumber()
  leasePrincipal?: number;

  @IsOptional()
  @IsNumber()
  leaseDailyRate?: number;

  @IsOptional()
  @IsNumber()
  leaseDownPayment?: number;
}
