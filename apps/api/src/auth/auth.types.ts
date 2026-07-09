import {
  FleetPlan,
  FleetSubscriptionStatus,
  UserRole,
  UserStatus,
  FleetType,
} from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  fleetId: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  fleetId: string;
  fleetName: string;
  fleetPlan: FleetPlan;
  fleetType: FleetType;
  subscriptionStatus: FleetSubscriptionStatus;
  upgradeRequested: boolean;
  role: UserRole;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  insurerName?: string | null;
  monthlyRatePerBike?: number;
  notifOpenIncidents: boolean;
  notifSosAlerts: boolean;
  notifCrashEvents: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
