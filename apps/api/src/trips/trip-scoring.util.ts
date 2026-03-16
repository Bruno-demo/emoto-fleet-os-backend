export interface TripEventCounts {
  OVERSPEED: number;
  SPEED_LIMIT_VIOLATION: number;
  SCHOOL_ZONE_SPEED: number;
  HOSPITAL_ZONE_SPEED: number;
  MARKET_ZONE_SPEED: number;
  HARSH_BRAKE: number;
  HARSH_ACCEL: number;
  HARSH_CORNER: number;
  CRASH: number;
  THEFT_SUSPECTED: number;
}

export interface TripScoreWeights {
  overspeed: number;
  speedLimitViolation: number;
  schoolZoneSpeed: number;
  hospitalZoneSpeed: number;
  marketZoneSpeed: number;
  harshBrake: number;
  harshAccel: number;
  harshCorner: number;
  crash: number;
  theftSuspected: number;
}

export const EMPTY_TRIP_EVENT_COUNTS: TripEventCounts = {
  OVERSPEED: 0,
  SPEED_LIMIT_VIOLATION: 0,
  SCHOOL_ZONE_SPEED: 0,
  HOSPITAL_ZONE_SPEED: 0,
  MARKET_ZONE_SPEED: 0,
  HARSH_BRAKE: 0,
  HARSH_ACCEL: 0,
  HARSH_CORNER: 0,
  CRASH: 0,
  THEFT_SUSPECTED: 0,
};

// Converts grouped event rows into a normalized set of trip-relevant event counters.
export function normalizeTripEventCounts(
  groupedRows: Array<{ type: string; count: number }>,
): TripEventCounts {
  const counts: TripEventCounts = { ...EMPTY_TRIP_EVENT_COUNTS };

  for (const row of groupedRows) {
    if (row.type in counts) {
      counts[row.type as keyof TripEventCounts] += row.count;
    }
  }

  return counts;
}

// Computes 0-100 trip score from weighted events per km with configurable penalty scaling.
export function computeTripScore(
  distanceKm: number,
  counts: TripEventCounts,
  weights: TripScoreWeights,
  penaltyMultiplier: number,
  minDistanceKm: number,
): number {
  const normalizedDistanceKm = Math.max(distanceKm, minDistanceKm);

  const weightedPenalty =
    (counts.OVERSPEED * weights.overspeed +
      counts.SPEED_LIMIT_VIOLATION * weights.speedLimitViolation +
      counts.SCHOOL_ZONE_SPEED * weights.schoolZoneSpeed +
      counts.HOSPITAL_ZONE_SPEED * weights.hospitalZoneSpeed +
      counts.MARKET_ZONE_SPEED * weights.marketZoneSpeed +
      counts.HARSH_BRAKE * weights.harshBrake +
      counts.HARSH_ACCEL * weights.harshAccel +
      counts.HARSH_CORNER * weights.harshCorner +
      counts.CRASH * weights.crash +
      counts.THEFT_SUSPECTED * weights.theftSuspected) /
    normalizedDistanceKm;

  const score = 100 - weightedPenalty * penaltyMultiplier;
  return clamp(score, 0, 100);
}

// Calculates haversine distance between two latitude/longitude points in kilometers.
export function haversineDistanceKm(
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
  return earthRadiusKm * c;
}

// Rounds numeric values to the required precision for persisted trip metrics.
export function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Restricts numeric value to closed interval.
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
