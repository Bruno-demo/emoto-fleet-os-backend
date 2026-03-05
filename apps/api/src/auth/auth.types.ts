import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  fleetId: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  fleetId: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  status: UserStatus;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
