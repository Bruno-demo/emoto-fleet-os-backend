import type { RoadFeatureType } from '@prisma/client';

export interface RoadFeatureSummary {
  id: string;
  type: RoadFeatureType;
  name: string | null;
  speedLimitKph: number | null;
  lat: number;
  lng: number;
}

export interface RoadFeatureBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}
