import { BikeStatus, PoiType, UserStatus } from '@prisma/client';
import type { FleetEvent } from '../events/events.types';

export interface RiderSummary {
  id: string;
  fleetId: string;
  phone: string | null;
  email: string | null;
  status: UserStatus;
  fullName: string | null;
  activeAssignments: AssignmentSummary[];
}

export interface AssignmentSummary {
  id: string;
  fleetId: string;
  bikeId: string;
  bikeLabel: string;
  bikeStatus: BikeStatus;
  riderUserId: string;
  riderFullName: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  active: boolean;
}

export interface PoiSummary {
  id: string;
  fleetId: string | null;
  type: PoiType;
  name: string;
  phone: string | null;
  lat: number;
  lng: number;
  address: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NearbyPoiSummary extends PoiSummary {
  distanceKm: number;
}

export interface RiderMeResponse {
  userId: string;
  fleetId: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  assignments: AssignmentSummary[];
}

export interface RiderTripSummary {
  id: string;
  bikeId: string;
  startTs: string;
  endTs: string | null;
  distanceKm: number;
  durationSec: number;
  score: number;
}

export interface RiderWeeklyScoreResponse {
  range: {
    from: string;
    to: string;
  };
  tripCount: number;
  avgScore: number;
  bestScore: number | null;
  worstScore: number | null;
}

export interface RiderSosResponse {
  event: FleetEvent;
  notifiedContacts: number;
  type: 'SOS';
}
