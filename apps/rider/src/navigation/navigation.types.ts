export type RiderRootStackParamList = {
  Login: undefined;
  App: undefined;
};

export type RiderTabParamList = {
  Home: undefined;
  TripsStack: undefined;
  SOS: undefined;
  PoiNearby: undefined;
};

export type RiderTripsStackParamList = {
  TripsList: undefined;
  TripDetail: {
    tripId: string;
  };
};
