import { DeviceCommandStatus, DeviceCommandType, Prisma } from '@prisma/client';

export interface FleetDeviceCommand {
  id: string;
  fleetId: string;
  deviceId: string;
  bikeId: string | null;
  type: DeviceCommandType;
  status: DeviceCommandStatus;
  requestedByUserId: string;
  requestedAt: Date;
  sentAt: Date | null;
  ackedAt: Date | null;
  payloadJson: Prisma.JsonValue;
  errorMessage: string | null;
  nonce: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
