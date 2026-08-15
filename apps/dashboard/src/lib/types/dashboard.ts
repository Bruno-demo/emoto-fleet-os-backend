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
  fleetPlan?: 'PAYG' | 'INSURANCE' | 'ENTERPRISE';
  fleetType?: 'COOP' | 'DELIVERY' | 'PERSONAL';
  subscriptionStatus?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PENDING_UPGRADE';
  upgradeRequested?: boolean;
  role: UserRole;
  email: string | null;
  phone: string | null;
  status: 'INVITED' | 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  insurerName?: string | null;
  monthlyRatePerBike?: number | null;
  momoPhoneNumber?: string | null;
  autoPayEnabled?: boolean;
  notifOpenIncidents?: boolean;
  notifSosAlerts?: boolean;
  notifCrashEvents?: boolean;
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
  insurerUserId?: string | null;
  insurerName?: string | null;
  imageUrl?: string | null;
  type?: string | null;
  leaseToOwn?: boolean;
  commands?: Array<{
    id: string;
    type: 'LOCK' | 'UNLOCK';
    status: string;
    updatedAt: string;
    errorMessage: string | null;
  }>;
  insurer?: {
    id: string;
    email: string | null;
    phone: string | null;
    riderProfile?: {
      fullName: string;
    } | null;
  } | null;
}

export interface Device {
  id: string;
  fleetId: string;
  imei: string | null;
  deviceUid: string;
  simPhoneNumber?: string | null;
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
  batteryPct?: number;
  ignition?: boolean;
  mainPowerCut?: boolean;
}

export interface RoadFeature {
  id: string;
  type: 'SCHOOL' | 'HOSPITAL' | 'MARKET' | 'TRAFFIC_SIGN' | 'SPEED_LIMIT';
  name: string | null;
  speedLimitKph: number | null;
  lat: number;
  lng: number;
}

export interface FleetEvent {
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
  metaJson: unknown;
  createdAt: string;
  bikeLabel?: string | null;
  bikePlate?: string | null;
  deviceUid?: string | null;
  riderName?: string | null;
}

export interface IncidentStats {
  open: number;
  acknowledged: number;
  resolved: number;
  falseAlarm: number;
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

export interface FleetTrip {
  id: string;
  fleetId: string;
  bikeId: string;
  bikeLabel?: string;
  bikePlate?: string | null;
  riderId: string | null;
  riderName?: string | null;
  startTs: string;
  endTs: string | null;
  distanceKm: number;
  durationSec: number;
  score: number;
  startBatteryPct: number | null;
  endBatteryPct: number | null;
  powerUsedPct: number | null;
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
  eventType?: string;
  bikeLabel?: string;
  bikePlate?: string;
  deviceUid?: string;
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
  type: 'SLOW' | 'NO_GO' | 'PARK' | 'WORK_BOUNDARY';
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
    fullName?: string;
    tripCount: number;
    avgScore: number;
  }>;
  dailyScores: Array<{ date: string; score: number }>;
}

export interface Rider {
  id: string;
  fleetId: string;
  phone: string | null;
  email: string | null;
  status: 'INVITED' | 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  fullName: string | null;
  licenceNumber?: string | null;
  identityNumber?: string | null;
  passportPhoto?: string | null;
  licencePhoto?: string | null;
  identityCardPhoto?: string | null;
  activeAssignments: Array<{
    id: string;
    bikeId: string;
    bikeLabel: string;
    bikeStatus: string;
  }>;
  leaseToOwn?: boolean;
  leasePrincipal?: number;
  leaseDailyRate?: number;
  paymentSchedule?: 'DAILY' | 'WEEKLY' | 'CUSTOM' | string;
  assignedRate?: number;
  customScheduleDays?: number | null;
  safetyScore?: number;
}

export type AuditActionType =
  | 'DEVICE_SECRET_ROTATED'
  | 'ZONE_CREATED'
  | 'ZONE_UPDATED'
  | 'ZONE_DELETED'
  | 'LOCK_ACTION_REQUESTED'
  | 'DEVICE_COMMAND_REQUESTED'
  | 'DEVICE_COMMAND_STATUS_CHANGED'
  | 'PARTNER_TOKEN_ISSUED'
  | 'PARTNER_API_ACCESS'
  | 'PARTNER_WEBHOOK_REGISTERED'
  | 'PARTNER_WEBHOOK_DELIVERY'
  | 'RIDER_CREATED'
  | 'BIKE_ASSIGNMENT_CHANGED'
  | 'SOS_TRIGGERED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'BIKE_CREATED'
  | 'BIKE_UPDATED'
  | 'BIKE_DELETED'
  | 'USER_ROLE_CHANGED'
  | 'USER_INVITED'
  | 'MOMO_PAYMENT_REQUESTED'
  | 'MOMO_PAYMENT_RECEIVED'
  | 'MOMO_PAYMENT_FAILED'
  | 'MOMO_PAYMENT_RETRIED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_RENEWED';

export interface AuditLogEntry {
  id: string;
  fleetId: string;
  actorUserId: string | null;
  actionType: AuditActionType;
  targetType: string;
  targetId: string | null;
  metaJson: Record<string, unknown>;
  createdAt: string;
  actorUser?: {
    id: string;
    email: string | null;
    phone: string | null;
  } | null;
}
