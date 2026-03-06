import { Prisma } from '@prisma/client';

export interface IncidentEvidencePackResponse {
  evidencePackId: string;
  incidentId: string;
  fleetId: string;
  createdAt: string;
  expiresInSeconds: number;
  summaryJsonUrl: string;
  telemetryCsvUrl: string;
}

export interface IncidentEvidenceSummary {
  incident: {
    id: string;
    fleetId: string;
    bikeId: string | null;
    deviceId: string;
    eventId: string;
    status: string;
    createdAt: string;
  };
  bike: {
    id: string;
    label: string;
    plate: string | null;
    serial: string | null;
    model: string | null;
    status: string;
  } | null;
  device: {
    id: string;
    deviceUid: string;
    imei: string | null;
    fwVersion: string | null;
    status: string;
    lastSeenAt: string | null;
  };
  trip: {
    id: string;
    startTs: string;
    endTs: string | null;
    distanceKm: number;
    durationSec: number;
    score: number;
  } | null;
  events: Array<{
    id: string;
    ts: string;
    type: string;
    severity: string;
    metaJson: Prisma.JsonValue;
  }>;
  telemetry: {
    windowStartTs: string;
    windowEndTs: string;
    rowCount: number;
  };
}
