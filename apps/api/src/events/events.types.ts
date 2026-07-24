import { EventSeverity, EventType, Prisma } from '@prisma/client';

export interface FleetEvent {
  id: string;
  fleetId: string;
  bikeId: string | null;
  deviceId: string;
  ts: Date;
  type: EventType;
  severity: EventSeverity;
  metaJson: Prisma.JsonValue;
  createdAt: Date;
  bikeLabel?: string | null;
  bikePlate?: string | null;
  deviceUid?: string | null;
  riderName?: string | null;
}

export interface CreateFleetEventInput {
  fleetId: string;
  bikeId: string | null;
  deviceId: string;
  ts: Date;
  type: EventType;
  severity: EventSeverity;
  metaJson: Prisma.InputJsonValue;
}
