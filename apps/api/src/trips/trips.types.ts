import { TripEventCounts } from './trip-scoring.util';

export interface FleetTrip {
  id: string;
  fleetId: string;
  bikeId: string;
  riderId: string | null;
  startTs: Date;
  endTs: Date | null;
  distanceKm: number;
  durationSec: number;
  score: number;
  eventCounts: TripEventCounts;
}
