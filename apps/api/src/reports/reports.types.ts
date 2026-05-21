import { TripEventCounts } from '../trips/trip-scoring.util';

export interface WeeklyRiskBike {
  bikeId: string;
  label: string;
  tripCount: number;
  avgScore: number;
  eventCount: number;
}

export interface WeeklyRiskRider {
  riderId: string;
  fullName: string;
  tripCount: number;
  avgScore: number;
}

export interface WeeklyReport {
  range: {
    from: string;
    to: string;
  };
  tripCount: number;
  avgScore: number;
  eventCounts: TripEventCounts;
  topRiskyBikes: WeeklyRiskBike[];
  topRiskyRiders: WeeklyRiskRider[];
}
