export type RiderRootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type RiderAuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotAccess: undefined;
  ResetAccess: {
    phone?: string;
    token?: string;
  } | undefined;
  OtpHelp: undefined;
};

export type RiderTabParamList = {
  Home: undefined;
  TripsStack: undefined;
  DeliveriesStack: undefined;
  Payments: undefined;
  SOS: undefined;
  PoiNearby: undefined;
  Profile: undefined;
};

export type RiderTripsStackParamList = {
  TripsList: undefined;
  TripDetail: {
    tripId: string;
  };
};

export type RiderDeliveriesStackParamList = {
  DeliveriesList: undefined;
  DeliveryDetail: {
    deliveryId: string;
  };
};
