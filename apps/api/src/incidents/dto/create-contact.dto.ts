import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmergencyContactRole } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ example: 'Operations Desk' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '+250700000002' })
  @IsString()
  @MaxLength(40)
  phone!: string;

  @ApiProperty({
    enum: EmergencyContactRole,
    example: EmergencyContactRole.DISPATCH,
  })
  @IsEnum(EmergencyContactRole)
  role!: EmergencyContactRole;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
