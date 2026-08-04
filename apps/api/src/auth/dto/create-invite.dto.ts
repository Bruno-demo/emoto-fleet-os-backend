import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateInviteDto {
  @ApiPropertyOptional({ enum: UserRole, example: UserRole.RIDER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: 'rider@demo.emoto' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+250700000222' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 72, description: 'Invite expiry in hours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours?: number;

  @ApiPropertyOptional({ example: 10, description: 'Maximum number of uses for multi-usable codes (default 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxUses?: number;
}
