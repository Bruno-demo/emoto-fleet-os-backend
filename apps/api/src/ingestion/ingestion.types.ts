export interface LiveBikeState {
  fleetId: string;
  bikeId: string;
  deviceId: string;
  deviceUid: string;
  ts: string;
  lat: number;
  lng: number;
  speedKph: number;
  heading?: number;
  batteryV?: number;
  batteryPct?: number;
  ignition?: boolean;
  mainPowerCut?: boolean;
}
