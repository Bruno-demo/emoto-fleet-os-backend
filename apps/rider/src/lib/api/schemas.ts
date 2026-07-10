import { z } from 'zod';

const numericIdSchema = z.string().regex(/^\d+$/);
const fleetIdSchema = z.string().min(1);
const uuidLikeSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

const authUserSchema = z.object({
  id: uuidLikeSchema,
  fleetId: fleetIdSchema,
  role: z.literal('RIDER'),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.enum(['INVITED', 'PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'DISABLED']),
});

// Union handles both direct-auth and OTP-challenge responses from the backend.
// Rider login should always receive the direct-auth variant because the backend
// bypasses OTP for RIDER role, but this defensive union prevents opaque Zod
// crashes if a stale backend build ever sends the OTP challenge instead.
export const loginResponseSchema = z.union([
  z.object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    user: authUserSchema,
  }),
  z.object({
    requireOtp: z.literal(true),
    email: z.string(),
    tempToken: z.string().min(1),
    otp: z.string().optional(),
  }),
]);

export const riderAssignmentSchema = z.object({
  id: uuidLikeSchema,
  fleetId: fleetIdSchema,
  bikeId: uuidLikeSchema,
  bikeLabel: z.string(),
  bikeStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
  riderUserId: uuidLikeSchema,
  riderFullName: z.string().nullable(),
  assignedAt: z.string(),
  unassignedAt: z.string().nullable(),
  active: z.boolean(),
});

export const riderMeResponseSchema = z.object({
  userId: uuidLikeSchema,
  fleetId: fleetIdSchema,
  phone: z.string().nullable(),
  email: z.string().nullable(),
  status: z.enum(['INVITED', 'PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'DISABLED']),
  plan: z.string(),
  fullName: z.string().nullable(),
  assignments: z.array(riderAssignmentSchema),
  isPersonalOwner: z.boolean(),
});

export const liveBikeStateSchema = z.object({
  deviceId: z.string(),
  bikeId: z.string(),
  fleetId: z.string(),
  ts: z.string(),
  lat: z.number(),
  lng: z.number(),
  speedKph: z.number(),
  heading: z.number(),
  batteryV: z.number(),
  batteryPct: z.number(),
  signalDbm: z.number(),
  gnssSats: z.number(),
  status: z.string(),
  motion: z.boolean(),
  ingestedAt: z.string(),
});

export const fleetDeviceCommandSchema = z.object({
  id: z.string(),
  fleetId: z.string(),
  deviceId: z.string(),
  bikeId: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  requestedByUserId: z.string(),
  requestedAt: z.string(),
  sentAt: z.string().nullable(),
  ackedAt: z.string().nullable(),
  payloadJson: z.unknown(),
  errorMessage: z.string().nullable(),
  nonce: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const riderTripSchema = z.object({
  id: uuidLikeSchema,
  bikeId: uuidLikeSchema,
  bikeLabel: z.string(),
  startTs: z.string(),
  endTs: z.string().nullable(),
  distanceKm: z.number(),
  durationSec: z.number(),
  score: z.number(),
  consumptionPct: z.number().nullable(),
});

const riderTripEventCountsSchema = z.object({
  OVERSPEED: z.number(),
  SPEED_LIMIT_VIOLATION: z.number(),
  SCHOOL_ZONE_SPEED: z.number(),
  HOSPITAL_ZONE_SPEED: z.number(),
  MARKET_ZONE_SPEED: z.number(),
  HARSH_BRAKE: z.number(),
  HARSH_ACCEL: z.number(),
  HARSH_CORNER: z.number(),
  CRASH: z.number(),
  THEFT_SUSPECTED: z.number(),
});

const riderTripScoreBreakdownSchema = z.object({
  minDistanceKm: z.number(),
  normalizedDistanceKm: z.number(),
  penaltyMultiplier: z.number(),
  weights: z.object({
    overspeed: z.number(),
    speedLimitViolation: z.number(),
    schoolZoneSpeed: z.number(),
    hospitalZoneSpeed: z.number(),
    marketZoneSpeed: z.number(),
    harshBrake: z.number(),
    harshAccel: z.number(),
    harshCorner: z.number(),
    crash: z.number(),
    theftSuspected: z.number(),
  }),
  penalties: z.object({
    OVERSPEED: z.number(),
    SPEED_LIMIT_VIOLATION: z.number(),
    SCHOOL_ZONE_SPEED: z.number(),
    HOSPITAL_ZONE_SPEED: z.number(),
    MARKET_ZONE_SPEED: z.number(),
    HARSH_BRAKE: z.number(),
    HARSH_ACCEL: z.number(),
    HARSH_CORNER: z.number(),
    CRASH: z.number(),
    THEFT_SUSPECTED: z.number(),
    total: z.number(),
  }),
});

export const riderTripDetailSchema = riderTripSchema.extend({
  eventCounts: riderTripEventCountsSchema,
  scoreBreakdown: riderTripScoreBreakdownSchema,
});

// Generates a typed schema for the API pagination envelope.
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });
}

export const riderWeeklyScoreSchema = z.object({
  range: z.object({
    from: z.string(),
    to: z.string(),
  }),
  tripCount: z.number(),
  avgScore: z.number(),
  bestScore: z.number().nullable(),
  worstScore: z.number().nullable(),
});

export const nearbyPoiSchema = z.object({
  id: uuidLikeSchema,
  fleetId: fleetIdSchema.nullable(),
  type: z.enum(['GARAGE', 'SWAP', 'CLINIC', 'OTHER']),
  name: z.string(),
  phone: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  distanceKm: z.number(),
});

export const riderEventSchema = z.object({
  id: numericIdSchema,
  bikeId: uuidLikeSchema.nullable(),
  deviceId: uuidLikeSchema,
  ts: z.string(),
  type: z.enum([
    'OVERSPEED',
    'SPEED_LIMIT_VIOLATION',
    'SCHOOL_ZONE_SPEED',
    'HOSPITAL_ZONE_SPEED',
    'MARKET_ZONE_SPEED',
    'HARSH_BRAKE',
    'HARSH_ACCEL',
    'HARSH_CORNER',
    'CRASH',
    'THEFT_SUSPECTED',
    'SOS',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  createdAt: z.string(),
});

export const riderSosResponseSchema = z.object({
  event: z.object({
    id: numericIdSchema,
    fleetId: fleetIdSchema,
    bikeId: uuidLikeSchema.nullable(),
    deviceId: uuidLikeSchema,
    ts: z.string(),
    type: z.string(),
    severity: z.string(),
    metaJson: z.unknown(),
    createdAt: z.string(),
  }),
  notifiedContacts: z.number(),
  type: z.literal('SOS'),
});

export const riderDeliverySchema = z.object({
  id: uuidLikeSchema,
  orderNumber: z.string(),
  pickupAddress: z.string(),
  pickupLat: z.number().or(z.string().transform(Number)),
  pickupLng: z.number().or(z.string().transform(Number)),
  dropoffAddress: z.string(),
  dropoffLat: z.number().or(z.string().transform(Number)),
  dropoffLng: z.number().or(z.string().transform(Number)),
  customerName: z.string(),
  customerPhone: z.string(),
  status: z.enum(['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED']),
  notes: z.string().nullable(),
  assignedAt: z.string().nullable(),
  pickedUpAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  createdAt: z.string(),
});
