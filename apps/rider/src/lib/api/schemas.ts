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
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED']),
});

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  user: authUserSchema,
});

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
  fullName: z.string().nullable(),
  assignments: z.array(riderAssignmentSchema),
});

export const riderTripSchema = z.object({
  id: uuidLikeSchema,
  bikeId: uuidLikeSchema,
  startTs: z.string(),
  endTs: z.string().nullable(),
  distanceKm: z.number(),
  durationSec: z.number(),
  score: z.number(),
});

const riderTripEventCountsSchema = z.object({
  OVERSPEED: z.number(),
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
    harshBrake: z.number(),
    harshAccel: z.number(),
    harshCorner: z.number(),
    crash: z.number(),
    theftSuspected: z.number(),
  }),
  penalties: z.object({
    OVERSPEED: z.number(),
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
