import { z } from 'zod';

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

export const riderSosResponseSchema = z.object({
  event: z.object({
    id: z.string().uuid(),
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
