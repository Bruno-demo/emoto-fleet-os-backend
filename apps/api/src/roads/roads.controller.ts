import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RoadFeaturesQueryDto } from './dto/road-features-query.dto';
import { RoadFeaturesService } from './roads.service';
import type { RoadFeatureBounds, RoadFeatureSummary } from './roads.types';

@ApiTags('roads')
@ApiBearerAuth()
@Controller('roads')
export class RoadsController {
  constructor(private readonly roadFeaturesService: RoadFeaturesService) {}

  @Get('features')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'List map-ready road features within a bounding box' })
  async listFeatures(
    @Query() query: RoadFeaturesQueryDto,
  ): Promise<RoadFeatureSummary[]> {
    const bounds = parseBounds(query.bbox);
    return this.roadFeaturesService.getFeaturesInBounds(
      bounds,
      query.types,
    );
  }
}

// Parses a bbox string into numeric bounds or throws when invalid.
function parseBounds(raw: string): RoadFeatureBounds {
  const parts = raw.split(',').map((value) => Number(value.trim()));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    throw new BadRequestException('bbox must be minLat,minLng,maxLat,maxLng');
  }

  const [minLat, minLng, maxLat, maxLng] = parts;
  if (
    minLat < -90 ||
    minLat > 90 ||
    maxLat < -90 ||
    maxLat > 90 ||
    minLng < -180 ||
    minLng > 180 ||
    maxLng < -180 ||
    maxLng > 180
  ) {
    throw new BadRequestException('bbox coordinates are out of range');
  }

  return { minLat, minLng, maxLat, maxLng };
}
