import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmergencyContactRole } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateContactDto {
  @ApiPropertyOptional({ example: 'Operations Desk - Night Shift' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '+250700000003' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({
    enum: EmergencyContactRole,
    example: EmergencyContactRole.MANAGER,
  })
  @IsOptional()
  @IsEnum(EmergencyContactRole)
  role?: EmergencyContactRole;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
