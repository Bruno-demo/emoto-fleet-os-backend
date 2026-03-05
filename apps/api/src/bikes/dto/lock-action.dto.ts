import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum LockActionType {
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
}

export class LockActionDto {
  @ApiProperty({ enum: LockActionType, example: LockActionType.LOCK })
  @IsEnum(LockActionType)
  action!: LockActionType;

  @ApiPropertyOptional({ example: 'Suspicious movement detected' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
