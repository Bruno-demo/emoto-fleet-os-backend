export type RiderRole = 'RIDER';

export interface AuthUser {
  id: string;
  fleetId: string;
  role: RiderRole;
  email: string | null;
  phone: string | null;
  status: 'INVITED' | 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}

export interface RiderAssignment {
  id: string;
  fleetId: string;
  bikeId: string;
  bikeLabel: string;
  bikeStatus: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
  riderUserId: string;
  riderFullName: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  active: boolean;
}

export interface RiderMeResponse {
  userId: string;
  fleetId: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  assignments: RiderAssignment[];
  isPersonalOwner: boolean;
}

export interface LiveBikeState {
  deviceId: string;
  bikeId: string;
  fleetId: string;
  ts: string;
  lat: number;
  lng: number;
  speedKph: number;
  heading: number;
  batteryV: number;
  batteryPct: number;
  signalDbm: number;
  gnssSats: number;
  status: string;
  motion: boolean;
  ingestedAt: string;
}

export interface FleetDeviceCommand {
  id: string;
  fleetId: string;
  deviceId: string;
  bikeId: string | null;
  type: string;
  status: string;
  requestedByUserId: string;
  requestedAt: string;
  sentAt: string | null;
  ackedAt: string | null;
  payloadJson: unknown;
  errorMessage: string | null;
  nonce: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiderTripSummary {
  id: string;
  bikeId: string;
  bikeLabel: string;
  startTs: string;
  endTs: string | null;
  distanceKm: number;
  durationSec: number;
  score: number;
  consumptionPct: number | null;
}

export interface RiderTripEventCounts {
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

export interface RiderTripScoreBreakdown {
  minDistanceKm: number;
  normalizedDistanceKm: number;
  penaltyMultiplier: number;
  weights: {
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
  };
  penalties: {
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
    total: number;
  };
}

export interface RiderTripDetail extends RiderTripSummary {
  eventCounts: RiderTripEventCounts;
  scoreBreakdown: RiderTripScoreBreakdown;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RiderWeeklyScoreResponse {
  range: {
    from: string;
    to: string;
  };
  tripCount: number;
  avgScore: number;
  bestScore: number | null;
  worstScore: number | null;
}

export type PoiType = 'GARAGE' | 'SWAP' | 'CLINIC' | 'OTHER';

export interface NearbyPoi {
  id: string;
  fleetId: string | null;
  type: PoiType;
  name: string;
  phone: string | null;
  lat: number;
  lng: number;
  address: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  distanceKm: number;
}

export interface RiderEventSummary {
  id: string;
  bikeId: string | null;
  deviceId: string;
  ts: string;
  type:
    | 'OVERSPEED'
    | 'SPEED_LIMIT_VIOLATION'
    | 'SCHOOL_ZONE_SPEED'
    | 'HOSPITAL_ZONE_SPEED'
    | 'MARKET_ZONE_SPEED'
    | 'HARSH_BRAKE'
    | 'HARSH_ACCEL'
    | 'HARSH_CORNER'
    | 'CRASH'
    | 'THEFT_SUSPECTED'
    | 'SOS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
}

export interface RiderSosResponse {
  event: {
    id: string;
    fleetId: string;
    bikeId: string | null;
    deviceId: string;
    ts: string;
    type: string;
    severity: string;
    metaJson: unknown;
    createdAt: string;
  };
  notifiedContacts: number;
  type: 'SOS';
}
