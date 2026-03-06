export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'DISPATCHER'
  | 'TECH'
  | 'INSURER'
  | 'RIDER';

export interface SessionUser {
  id: string;
  fleetId: string;
  fleetName?: string | null;
  role: UserRole;
  email: string | null;
  phone: string | null;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
}

export interface Bike {
  id: string;
  fleetId: string;
  label: string;
  plate: string | null;
  serial: string | null;
  model: string | null;
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  fleetId: string;
  imei: string | null;
  deviceUid: string;
  bikeId: string | null;
  lastSeenAt: string | null;
  fwVersion: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  createdAt: string;
  updatedAt: string;
  bike: {
    id: string;
    label: string;
  } | null;
}

export interface LiveBikeState {
  fleetId: string;
  bikeId: string;
  deviceId: string;
  deviceUid?: string;
  ts: string;
  lat: number;
  lng: number;
  speedKph: number;
  heading?: number;
  batteryV?: number;
  ignition?: boolean;
}

export interface FleetEvent {
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
  metaJson: unknown;
  createdAt: string;
}

export interface BikeTrip {
  id: string;
  fleetId: string;
  bikeId: string;
  riderId: string | null;
  startTs: string;
  endTs: string | null;
  distanceKm: number;
  durationSec: number;
  score: number;
  eventCounts: Record<string, number>;
}

export interface DeviceCommand {
  id: string;
  fleetId: string;
  deviceId: string;
  bikeId: string | null;
  type: 'LOCK' | 'UNLOCK';
  status: 'PENDING' | 'SENT' | 'ACKED' | 'FAILED' | 'EXPIRED';
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

export interface CommandStatusEvent {
  commandId: string;
  status: 'PENDING' | 'SENT' | 'ACKED' | 'FAILED' | 'EXPIRED' | 'QUEUED' | 'NOT_IMPLEMENTED';
  ts: string;
  bikeId?: string;
  deviceId?: string;
  action?: string;
  message?: string;
}

export interface Incident {
  id: string;
  fleetId: string;
  bikeId: string | null;
  deviceId: string;
  eventId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM';
  createdAt: string;
  updatedAt: string;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  notes: string | null;
}

export interface IncidentEvidencePack {
  evidencePackId: string;
  incidentId: string;
  fleetId: string;
  createdAt: string;
  expiresInSeconds: number;
  summaryJsonUrl: string;
  telemetryCsvUrl: string;
}

export interface Zone {
  id: string;
  fleetId: string;
  name: string;
  type: 'SLOW' | 'NO_GO' | 'PARK';
  geojsonPolygon: unknown;
  speedLimitKph: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
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

export interface WeeklyReport {
  range: { from: string; to: string };
  tripCount: number;
  avgScore: number;
  eventCounts: Record<string, number>;
  topRiskyBikes: Array<{
    bikeId: string;
    label: string;
    tripCount: number;
    avgScore: number;
    eventCount: number;
  }>;
  topRiskyRiders: Array<{
    riderId: string;
    tripCount: number;
    avgScore: number;
  }>;
}
