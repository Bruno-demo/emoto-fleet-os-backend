import type { UserRole } from '@/lib/types/dashboard';

// Returns true when role can request lock/unlock and provision device credentials.
export function canProvisionDevices(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'TECH';
}

// Returns true when role can manage geofence zones with create/edit/delete actions.
export function canManageZones(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

// Returns true when role can access rider assignment management endpoint.
export function canViewAssignments(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'TECH';
}
