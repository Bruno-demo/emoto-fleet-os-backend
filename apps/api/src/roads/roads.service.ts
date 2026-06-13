import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  RoadFeatureOsmType,
  RoadFeatureSource,
  RoadFeatureType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { RoadFeatureBounds, RoadFeatureSummary } from './roads.types';

const DEFAULT_TYPES: RoadFeatureType[] = [
  RoadFeatureType.SCHOOL,
  RoadFeatureType.HOSPITAL,
  RoadFeatureType.MARKET,
  RoadFeatureType.TRAFFIC_SIGN,
  RoadFeatureType.SPEED_LIMIT,
];

interface OverpassElement {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

@Injectable()
export class RoadFeaturesService {
  private readonly logger = new Logger(RoadFeaturesService.name);
  private readonly overpassUrl: string;
  private readonly cacheTtlSeconds: number;
  private readonly refreshSeconds: number;
  private readonly maxFetchResults: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.overpassUrl = this.configService.get<string>(
      'OVERPASS_API_URL',
      'https://overpass-api.de/api/interpreter',
    );
    this.cacheTtlSeconds = this.configService.get<number>(
      'ROAD_FEATURE_CACHE_TTL_SECONDS',
      3600,
    );
    this.refreshSeconds = this.configService.get<number>(
      'ROAD_FEATURE_REFRESH_SECONDS',
      86_400,
    );
    this.maxFetchResults = this.configService.get<number>(
      'ROAD_FEATURE_MAX_RESULTS',
      600,
    );
  }

  // Loads map-ready features for a bounding box with caching and periodic refresh.
  async getFeaturesInBounds(
    bounds: RoadFeatureBounds,
    types: RoadFeatureType[] = DEFAULT_TYPES,
  ): Promise<RoadFeatureSummary[]> {
    const normalizedBounds = normalizeBounds(bounds);
    const cacheKey = this.cacheKey(normalizedBounds, types);
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as RoadFeatureSummary[];
    }

    const success = await this.refreshFeaturesIfStale(normalizedBounds);
    const features = await this.loadFeatures(normalizedBounds, types);
    if (success) {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(features),
        this.cacheTtlSeconds,
      );
    }
    return features;
  }

  // Loads features around a telemetry point for rule evaluation.
  async getNearbyFeatures(
    lat: number,
    lng: number,
    radiusMeters: number,
    types: RoadFeatureType[] = DEFAULT_TYPES,
  ): Promise<RoadFeatureSummary[]> {
    const bounds = buildBoundsFromRadius(lat, lng, radiusMeters);
    const features = await this.getFeaturesInBounds(bounds, types);
    return features.filter((feature) => {
      const distanceMeters = haversineDistanceMeters(
        lat,
        lng,
        feature.lat,
        feature.lng,
      );
      return distanceMeters <= radiusMeters;
    });
  }

  // Reloads Overpass data when cached features are stale or missing.
  private async refreshFeaturesIfStale(
    bounds: RoadFeatureBounds,
  ): Promise<boolean> {
    const existing = await this.prismaService.roadFeature.findFirst({
      where: {
        lat: { gte: bounds.minLat, lte: bounds.maxLat },
        lng: { gte: bounds.minLng, lte: bounds.maxLng },
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    if (
      existing &&
      Date.now() - existing.updatedAt.getTime() < this.refreshSeconds * 1000
    ) {
      return true;
    }

    const fetched = await this.fetchOverpassFeatures(bounds);
    if (fetched === null) {
      return false;
    }
    if (!fetched.length) {
      return true;
    }

    await this.prismaService.$transaction(
      fetched.map((feature) => {
        const tagsJson = feature.tagsJson ?? Prisma.JsonNull;
        return this.prismaService.roadFeature.upsert({
          where: {
            source_osmId_osmType: {
              source: RoadFeatureSource.OSM,
              osmId: feature.osmId,
              osmType: feature.osmType,
            },
          },
          update: {
            type: feature.type,
            name: feature.name,
            speedLimitKph: feature.speedLimitKph,
            lat: feature.lat,
            lng: feature.lng,
            tagsJson,
          },
          create: {
            id: feature.id,
            source: RoadFeatureSource.OSM,
            osmId: feature.osmId,
            osmType: feature.osmType,
            type: feature.type,
            name: feature.name,
            speedLimitKph: feature.speedLimitKph,
            lat: feature.lat,
            lng: feature.lng,
            tagsJson,
          },
        });
      }),
    );
  }

  // Queries the database for features in a bounding box.
  private async loadFeatures(
    bounds: RoadFeatureBounds,
    types: RoadFeatureType[],
  ): Promise<RoadFeatureSummary[]> {
    const rows = await this.prismaService.roadFeature.findMany({
      where: {
        lat: { gte: bounds.minLat, lte: bounds.maxLat },
        lng: { gte: bounds.minLng, lte: bounds.maxLng },
        type: { in: types },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      speedLimitKph: row.speedLimitKph ?? null,
      lat: row.lat.toNumber(),
      lng: row.lng.toNumber(),
    }));
  }

  // Pulls road, amenity, and sign features from the Overpass API.
  private async fetchOverpassFeatures(bounds: RoadFeatureBounds): Promise<
    Array<{
      id: string;
      osmId: string;
      osmType: RoadFeatureOsmType;
      type: RoadFeatureType;
      name: string | null;
      speedLimitKph: number | null;
      lat: number;
      lng: number;
      tagsJson: Record<string, string> | null;
    }> | null
  > {
    const bbox = `${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng}`;
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"school|hospital|marketplace"](${bbox});
        way["amenity"~"school|hospital|marketplace"](${bbox});
        node["highway"="traffic_signals"](${bbox});
        node["traffic_sign"](${bbox});
        way["maxspeed"](${bbox});
      );
      out center tags ${this.maxFetchResults};
    `;

    try {
      const response = await fetch(this.overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        this.logger.warn(
          `Overpass request failed with status ${response.status}`,
        );
        return null;
      }

      const payload = (await response.json()) as {
        elements: OverpassElement[];
      };
      const elements = payload.elements ?? [];
      return elements
        .map((element) => this.normalizeOverpassElement(element))
        .filter(
          (feature): feature is NonNullable<typeof feature> => feature !== null,
        );
    } catch (error: unknown) {
      this.logger.warn('Overpass request failed', error as Error);
      return null;
    }
  }

  // Converts Overpass elements into normalized road feature rows.
  private normalizeOverpassElement(element: OverpassElement) {
    const tags = element.tags ?? {};
    const amenity = tags.amenity;
    const isTrafficSignal = tags.highway === 'traffic_signals';
    const hasTrafficSign = Boolean(tags.traffic_sign);
    const hasSpeedLimit = Boolean(tags.maxspeed);

    const location = resolveElementLocation(element);
    if (!location) {
      return null;
    }

    const speedLimitKph = hasSpeedLimit
      ? parseSpeedLimitKph(tags.maxspeed)
      : null;
    const featureType = resolveFeatureType({
      amenity,
      isTrafficSignal,
      hasTrafficSign,
      hasSpeedLimit,
    });
    if (!featureType) {
      return null;
    }

    return {
      id: randomUUID(),
      osmId: String(element.id),
      osmType: mapOsmType(element.type),
      type: featureType,
      name: tags.name ?? null,
      speedLimitKph,
      lat: location.lat,
      lng: location.lng,
      tagsJson: Object.keys(tags).length ? tags : null,
    };
  }

  // Builds cache keys that keep feature lookups stable for each bounding box.
  private cacheKey(
    bounds: RoadFeatureBounds,
    types: RoadFeatureType[],
  ): string {
    const typeKey = types.length ? [...types].sort().join('|') : 'ALL';
    return `roads:features:${bounds.minLat}:${bounds.minLng}:${bounds.maxLat}:${bounds.maxLng}:${typeKey}`;
  }
}

// Normalizes bounds ordering so min/max are always correct.
function normalizeBounds(bounds: RoadFeatureBounds): RoadFeatureBounds {
  return {
    minLat: Math.min(bounds.minLat, bounds.maxLat),
    maxLat: Math.max(bounds.minLat, bounds.maxLat),
    minLng: Math.min(bounds.minLng, bounds.maxLng),
    maxLng: Math.max(bounds.minLng, bounds.maxLng),
  };
}

// Creates a lightweight bounding box around a center coordinate and radius.
function buildBoundsFromRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
): RoadFeatureBounds {
  const radiusKm = radiusMeters / 1000;
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

// Parses speed-limit tags into a numeric kph value when possible.
function parseSpeedLimitKph(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (Number.isNaN(value)) {
    return null;
  }
  if (raw.toLowerCase().includes('mph')) {
    return Math.round(value * 1.609);
  }
  return Math.round(value);
}

// Maps OSM tags to internal road feature types.
function resolveFeatureType(input: {
  amenity?: string;
  isTrafficSignal: boolean;
  hasTrafficSign: boolean;
  hasSpeedLimit: boolean;
}): RoadFeatureType | null {
  if (input.hasSpeedLimit) {
    return RoadFeatureType.SPEED_LIMIT;
  }
  if (input.amenity === 'school') {
    return RoadFeatureType.SCHOOL;
  }
  if (input.amenity === 'hospital') {
    return RoadFeatureType.HOSPITAL;
  }
  if (input.amenity === 'marketplace') {
    return RoadFeatureType.MARKET;
  }
  if (input.isTrafficSignal || input.hasTrafficSign) {
    return RoadFeatureType.TRAFFIC_SIGN;
  }
  return null;
}

// Resolves point coordinates from node/way/relational elements.
function resolveElementLocation(
  element: OverpassElement,
): { lat: number; lng: number } | null {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lng: element.lon };
  }
  if (
    element.center &&
    typeof element.center.lat === 'number' &&
    typeof element.center.lon === 'number'
  ) {
    return { lat: element.center.lat, lng: element.center.lon };
  }
  return null;
}

// Converts Overpass element type strings into Prisma enum values.
function mapOsmType(type: OverpassElement['type']): RoadFeatureOsmType {
  if (type === 'way') {
    return RoadFeatureOsmType.WAY;
  }
  if (type === 'relation') {
    return RoadFeatureOsmType.RELATION;
  }
  return RoadFeatureOsmType.NODE;
}

// Calculates haversine distance between two points in meters.
function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c * 1000;
}
