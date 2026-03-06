import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmergencyContactRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListContactsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: EmergencyContactRole,
    example: EmergencyContactRole.DISPATCH,
  })
  @IsOptional()
  @IsEnum(EmergencyContactRole)
  role?: EmergencyContactRole;
}
