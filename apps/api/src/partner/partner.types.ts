import { IncidentStatus, PartnerStatus, Prisma, Trip } from '@prisma/client';
import { Request } from 'express';

export interface PartnerJwtPayload {
  sub: string;
  partnerId: string;
  clientId: string;
  scopes: string[];
  tokenType: 'partner';
}

export interface AuthenticatedPartner {
  partnerId: string;
  partnerName: string;
  partnerStatus: PartnerStatus;
  partnerClientId: string;
  scopes: string[];
}

export interface PartnerAuthenticatedRequest extends Request {
  partner: AuthenticatedPartner;
}

export interface PartnerTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  scopes: string[];
}

export interface PartnerWeeklySummary {
  fleetId: string;
  from: string;
  to: string;
  tripCount: number;
  eventCount: number;
  incidentCount: number;
  crashCount: number;
  avgScore: number;
}

export interface PartnerTripSummary {
  id: string;
  bikeId: string;
  startTs: string;
  endTs: string | null;
  durationSec: number;
  distanceKm: number;
  score: number;
}

export interface PartnerIncidentTimelineEvent {
  id: string;
  ts: string;
  type: string;
  severity: string;
  metaJson: Prisma.JsonValue;
}

export interface PartnerIncidentDetails {
  incidentId: string;
  fleetId: string;
  bikeId: string | null;
  deviceId: string;
  eventId: string;
  status: IncidentStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  timeline: PartnerIncidentTimelineEvent[];
}

export interface PartnerEvidencePackSummary {
  incidentId: string;
  status: 'PENDING_GENERATION';
  summary: Prisma.JsonValue;
  downloadUrl: string | null;
}

export interface PartnerWebhookRegistration {
  id: string;
  url: string;
  active: boolean;
  secret: string;
}

// Maps persisted trips into partner-safe summary fields.
export function toPartnerTripSummary(trip: Trip): PartnerTripSummary {
  return {
    id: trip.id,
    bikeId: trip.bikeId,
    startTs: trip.startTs.toISOString(),
    endTs: trip.endTs ? trip.endTs.toISOString() : null,
    durationSec: trip.durationSec,
    distanceKm: Number(trip.distanceKm),
    score: Number(trip.score),
  };
}
