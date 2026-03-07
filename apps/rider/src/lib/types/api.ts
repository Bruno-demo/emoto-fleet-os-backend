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
