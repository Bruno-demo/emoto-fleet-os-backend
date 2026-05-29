import { TripEventCounts } from './trip-scoring.util';

export interface FleetTrip {
  id: string;
  fleetId: string;
  bikeId: string;
  bikeLabel?: string;
  riderId: string | null;
  riderName?: string | null;
  startTs: Date;
  endTs: Date | null;
  distanceKm: number;
  durationSec: number;
  score: number;
  startBatteryPct: number | null;
  endBatteryPct: number | null;
  powerUsedPct: number | null;
  eventCounts: TripEventCounts;
}
