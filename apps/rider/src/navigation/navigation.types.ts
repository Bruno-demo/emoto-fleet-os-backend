export type RiderRootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type RiderAuthStackParamList = {
  Login: undefined;
  ForgotAccess: undefined;
  ResetAccess: {
    phone?: string;
  } | undefined;
  OtpHelp: undefined;
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
