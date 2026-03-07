import { z } from 'zod';

const numericIdSchema = z.string().regex(/^\d+$/);

const authUserSchema = z.object({
  id: z.string().uuid(),
  fleetId: z.string().uuid(),
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
  id: z.string().uuid(),
  fleetId: z.string().uuid(),
  bikeId: z.string().uuid(),
  bikeLabel: z.string(),
  bikeStatus: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
  riderUserId: z.string().uuid(),
  riderFullName: z.string().nullable(),
  assignedAt: z.string(),
  unassignedAt: z.string().nullable(),
  active: z.boolean(),
});

export const riderMeResponseSchema = z.object({
  userId: z.string().uuid(),
  fleetId: z.string().uuid(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  fullName: z.string().nullable(),
  assignments: z.array(riderAssignmentSchema),
});

export const riderTripSchema = z.object({
  id: z.string().uuid(),
  bikeId: z.string().uuid(),
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
  id: z.string().uuid(),
  fleetId: z.string().uuid().nullable(),
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
  bikeId: z.string().uuid().nullable(),
  deviceId: z.string().uuid(),
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
    fleetId: z.string().uuid(),
    bikeId: z.string().uuid().nullable(),
    deviceId: z.string().uuid(),
    ts: z.string(),
    type: z.string(),
    severity: z.string(),
    metaJson: z.unknown(),
    createdAt: z.string(),
  }),
  notifiedContacts: z.number(),
  type: z.literal('SOS'),
});
