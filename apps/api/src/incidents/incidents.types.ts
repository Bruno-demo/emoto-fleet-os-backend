import {
  EmergencyContactRole,
  IncidentStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';

export interface FleetIncident {
  id: string;
  fleetId: string;
  bikeId: string | null;
  deviceId: string;
  eventId: string;
  status: IncidentStatus;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedByUserId: string | null;
  acknowledgedAt: Date | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  notes: string | null;
}

export interface FleetEmergencyContact {
  id: string;
  fleetId: string;
  name: string;
  phone: string;
  role: EmergencyContactRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FleetNotification {
  id: string;
  fleetId: string;
  type: NotificationType;
  channel: NotificationChannel;
  to: string;
  payloadJson: Prisma.JsonValue;
  status: NotificationStatus;
  attemptCount: number;
  partnerWebhookId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface NotificationDispatchInput {
  id: string;
  fleetId: string;
  type: NotificationType;
  channel: NotificationChannel;
  to: string;
  payloadJson: Prisma.JsonValue;
  partnerWebhookId: string | null;
  attemptCount: number;
}

export interface IncidentBroadcastPayload {
  id: string;
  bikeId: string | null;
  deviceId: string;
  eventId: string;
  status: IncidentStatus;
  createdAt: string;
}
