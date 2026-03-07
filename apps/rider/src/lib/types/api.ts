export type RiderRole = 'RIDER';

export interface AuthUser {
  id: string;
  fleetId: string;
  role: RiderRole;
  email: string | null;
  phone: string | null;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
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
}

export interface RiderTripSummary {
  id: string;
  bikeId: string;
  startTs: string;
  endTs: string | null;
  distanceKm: number;
  durationSec: number;
  score: number;
}

export interface RiderTripEventCounts {
  OVERSPEED: number;
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
    harshBrake: number;
    harshAccel: number;
    harshCorner: number;
    crash: number;
    theftSuspected: number;
  };
  penalties: {
    OVERSPEED: number;
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
