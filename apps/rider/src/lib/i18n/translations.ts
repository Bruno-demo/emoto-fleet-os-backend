export type SupportedLanguage = 'en' | 'rw';

export interface Translations {
  // Common / Shared
  common: {
    loading: string;
    updating: string;
    error: string;
    retry: string;
    close: string;
    save: string;
    cancel: string;
    confirm: string;
    back: string;
    none: string;
    active: string;
    inactive: string;
    online: string;
    offline: string;
    copied: string;
    copy: string;
    total: string;
    today: string;
    thisWeek: string;
    viewAll: string;
    submit: string;
    duration: string;
    used: string;
    signOut: string;
  };
  // Navigation tabs
  tabs: {
    home: string;
    trips: string;
    deliveries: string;
    payments: string;
    sos: string;
    nearby: string;
    profile: string;
  };
  // Offline & Pending setup
  statusBanners: {
    offlineTitle: string;
    offlineSub: string;
    pendingTitle: string;
    pendingSub: string;
    pendingCta: string;
  };
  // Auth Flow
  auth: {
    welcomeTitle: string;
    welcomeSub: string;
    identifierLabel: string;
    identifierPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    loginButton: string;
    loggingIn: string;
    registerLink: string;
    forgotPasswordLink: string;
    otpTitle: string;
    otpSub: string;
    otpLabel: string;
    verifyOtp: string;
    resendOtp: string;
    registerTitle: string;
    fullNameLabel: string;
    phoneLabel: string;
    emailLabel: string;
    fleetCodeLabel: string;
    registerButton: string;
    hasAccountLink: string;
    forgotTitle: string;
    forgotSub: string;
    sendResetLink: string;
    resetTitle: string;
    newPasswordLabel: string;
    resetButton: string;
  };
  // Home Screen
  home: {
    greeting: string;
    safetyScore: string;
    scoreSubtitle: string;
    assignedBike: string;
    noBike: string;
    quickActions: string;
    actionSos: string;
    actionPoi: string;
    actionPay: string;
    actionTrips: string;
    recentActivity: string;
    noRecentTrips: string;
    avgWeeklyScore: string;
    totalKmThisWeek: string;
    tripsCount: string;
    myBikeControls: string;
    batteryStatus: string;
    unlock: string;
    lock: string;
    myBikeLocation: string;
    gpsTracking: string;
    trackOnLiveMap: string;
    lastTrip: string;
    coaching: string;
    coachingSubtitle: string;
    recentAlerts: string;
    allClear: string;
    allClearDesc: string;
    bikesCount: string;
    primaryBike: string;
    alertsCount: string;
  };
  // Profile Screen
  profile: {
    title: string;
    languageSection: string;
    languageEnglish: string;
    languageKinyarwanda: string;
    accountSection: string;
    fullName: string;
    phone: string;
    email: string;
    notSet: string;
    assignedBikes: string;
    noBikesAssigned: string;
    activeStatus: string;
    inactiveStatus: string;
    since: string;
    scoreBreakdown: string;
    bestScore: string;
    averageScore: string;
    worstScore: string;
    supportDiagnostics: string;
    systemDiagnostics: string;
    showDetails: string;
    hideDetails: string;
    diagnosticsDesc: string;
    riderUserId: string;
    operatingFleetId: string;
    signOut: string;
    toggleActiveOnline: string;
    toggleOffline: string;
  };
  // Trips & Trip Detail Screen
  trips: {
    title: string;
    tripDetailTitle: string;
    filterAll: string;
    filterCompleted: string;
    filterOngoing: string;
    distance: string;
    duration: string;
    score: string;
    startTime: string;
    endTime: string;
    eventsDetected: string;
    noEvents: string;
    routeMap: string;
    maxSpeed: string;
    avgSpeed: string;
    harshBraking: string;
    harshAcceleration: string;
    noTripsFound: string;
    eventsSubtitle: string;
    scoreBreakdownSubtitle: string;
    overspeed: string;
    hardBrake: string;
    hardAccel: string;
    hardCorner: string;
    crash: string;
    harshTotal: string;
    critical: string;
    totalPenalty: string;
    harshRiding: string;
    scoredDistance: string;
    start: string;
    end: string;
    inProgress: string;
  };
  // Payments Screen
  payments: {
    title: string;
    leaseBalance: string;
    dailyRate: string;
    unpaidDebts: string;
    weeklyGrid: string;
    paymentHistory: string;
    noPaymentsYet: string;
    collectTitle: string;
    amount: string;
    method: string;
    reference: string;
    payNow: string;
    statusPaid: string;
    statusUnpaid: string;
    statusPartial: string;
    leaseToOwnPlan: string;
    dailyRental: string;
    perDay: string;
    leasePrincipalPaid: string;
    paid: string;
    total: string;
    periodSchedule: string;
    requiredPeriodContribution: string;
    scheduleDaily: string;
    scheduleWeekly: string;
    scheduleCustom: string;
    partialReasonRequired: string;
    partialReasonPlaceholder: string;
    partialReasonError: string;
  };
  // Deliveries Screen
  deliveries: {
    title: string;
    orderDetailTitle: string;
    statusPending: string;
    statusInProgress: string;
    statusCompleted: string;
    statusCancelled: string;
    pickupAddress: string;
    dropoffAddress: string;
    customerName: string;
    customerPhone: string;
    startDelivery: string;
    completeDelivery: string;
    noDeliveries: string;
    assignedOrders: string;
    pickup: string;
    dropoff: string;
    customer: string;
    callCustomer: string;
    routeAction: string;
  };
  // SOS & Nearby POIs
  sos: {
    title: string;
    alertTitle: string;
    alertDesc: string;
    pressToHold: string;
    sending: string;
    sentSuccess: string;
    emergencyContacts: string;
    callSupport: string;
    notifyContacts: string;
    reference: string;
    sendAnother: string;
    tapToAlert: string;
    whenToUse: string;
  };
  nearby: {
    title: string;
    searchPlaceholder: string;
    chargingStations: string;
    mechanics: string;
    hospitals: string;
    police: string;
    noResults: string;
    getDirections: string;
    callStation: string;
    locationSection: string;
    getLocation: string;
    refreshLocation: string;
    gettingLocation: string;
  };
}

export const translations: Record<SupportedLanguage, Translations> = {
  en: {
    common: {
      loading: 'Loading...',
      updating: 'Updating...',
      error: 'An error occurred',
      retry: 'Retry',
      close: 'Close',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      none: 'None',
      active: 'Active',
      inactive: 'Inactive',
      online: 'Online',
      offline: 'Offline',
      copied: '✓ Copied',
      copy: '📋 Copy',
      total: 'Total',
      today: 'Today',
      thisWeek: 'This Week',
      viewAll: 'View All',
      submit: 'Submit',
      duration: 'duration',
      used: 'used',
      signOut: 'Sign out',
    },
    tabs: {
      home: 'Home',
      trips: 'Trips',
      deliveries: 'Deliveries',
      payments: 'Payments',
      sos: 'SOS',
      nearby: 'Nearby',
      profile: 'Profile',
    },
    statusBanners: {
      offlineTitle: 'Offline Mode',
      offlineSub: 'Check your internet connection to sync live telemetry.',
      pendingTitle: 'Setup Pending',
      pendingSub: 'Your fleet administrator is configuring your bike assignment.',
      pendingCta: 'Contact Fleet Admin',
    },
    auth: {
      welcomeTitle: 'Welcome Back',
      welcomeSub: 'Sign in to access your rider portal and trips.',
      identifierLabel: 'Email or Phone Number',
      identifierPlaceholder: 'enter email or phone...',
      passwordLabel: 'Password',
      passwordPlaceholder: 'enter password...',
      loginButton: 'Sign In',
      loggingIn: 'Signing in...',
      registerLink: 'New rider? Create an account',
      forgotPasswordLink: 'Forgot your password?',
      otpTitle: 'Enter Verification OTP',
      otpSub: 'We sent a 6-digit code to your email/phone.',
      otpLabel: 'OTP Code',
      verifyOtp: 'Verify & Sign In',
      resendOtp: 'Resend OTP Code',
      registerTitle: 'Rider Registration',
      fullNameLabel: 'Full Name',
      phoneLabel: 'Phone Number',
      emailLabel: 'Email Address (Optional)',
      fleetCodeLabel: 'Fleet Code',
      registerButton: 'Complete Registration',
      hasAccountLink: 'Already have an account? Sign In',
      forgotTitle: 'Reset Password',
      forgotSub: 'Enter your phone or email to receive recovery instructions.',
      sendResetLink: 'Send Recovery Code',
      resetTitle: 'Set New Password',
      newPasswordLabel: 'New Password',
      resetButton: 'Save New Password',
    },
    home: {
      greeting: 'Hello',
      safetyScore: 'Safety Score',
      scoreSubtitle: 'Based on your weekly driving dynamics',
      assignedBike: 'Assigned Bike',
      noBike: 'No Bike Assigned',
      quickActions: 'Quick Actions',
      actionSos: 'Emergency SOS',
      actionPoi: 'Nearby Stations',
      actionPay: 'Pay Lease',
      actionTrips: 'My Trips',
      recentActivity: 'Recent Trips',
      noRecentTrips: 'No recent trips recorded yet',
      avgWeeklyScore: 'Avg Score',
      totalKmThisWeek: 'Distance',
      tripsCount: 'Trips',
      myBikeControls: 'My Bike Controls',
      batteryStatus: 'Battery Status',
      unlock: 'Unlock',
      lock: 'Lock',
      myBikeLocation: 'My Bike Location',
      gpsTracking: 'GPS Tracking',
      trackOnLiveMap: 'Track on Live Map',
      lastTrip: 'Last Trip',
      coaching: 'Coaching',
      coachingSubtitle: 'Quick actions for a safer week',
      recentAlerts: 'Recent Alerts',
      allClear: 'All Clear',
      allClearDesc: 'No recent alerts. Clean riding keeps this feed quiet.',
      bikesCount: 'Bikes',
      primaryBike: 'Primary',
      alertsCount: 'Alerts',
    },
    profile: {
      title: 'Profile & Settings',
      languageSection: 'Language / Ururimi',
      languageEnglish: '🇬🇧 English',
      languageKinyarwanda: '🇷🇼 Kinyarwanda',
      accountSection: 'Account Information',
      fullName: 'Full Name',
      phone: 'Phone Number',
      email: 'Email Address',
      notSet: 'Not set',
      assignedBikes: 'Assigned Vehicles',
      noBikesAssigned: 'No bikes assigned yet',
      activeStatus: 'Active',
      inactiveStatus: 'Inactive',
      since: 'Since',
      scoreBreakdown: 'Weekly Driving Score',
      bestScore: 'Best',
      averageScore: 'Average',
      worstScore: 'Worst',
      supportDiagnostics: 'Support & Diagnostics',
      systemDiagnostics: 'System Diagnostics',
      showDetails: 'Show details ▼',
      hideDetails: 'Hide details ▲',
      diagnosticsDesc: 'If you experience issues with your bike, connectivity, or trips, our support team may request the identifiers below. Tap any value to copy.',
      riderUserId: 'RIDER USER ID',
      operatingFleetId: 'OPERATING FLEET ID',
      signOut: 'Sign Out',
      toggleActiveOnline: '🟢 Active & Online',
      toggleOffline: '⚫ Offline Mode',
    },
    trips: {
      title: 'Trip Logs',
      tripDetailTitle: 'Trip Details',
      filterAll: 'All Trips',
      filterCompleted: 'Completed',
      filterOngoing: 'Active',
      distance: 'Distance',
      duration: 'Duration',
      score: 'Safety Score',
      startTime: 'Started',
      endTime: 'Ended',
      eventsDetected: 'Safety Events',
      noEvents: 'No safety violations during this trip',
      routeMap: 'Trip Route',
      maxSpeed: 'Max Speed',
      avgSpeed: 'Avg Speed',
      harshBraking: 'Harsh Brakes',
      harshAcceleration: 'Harsh Accel',
      noTripsFound: 'No trip records found.',
      eventsSubtitle: 'Penalties by type',
      scoreBreakdownSubtitle: 'Penalty details',
      overspeed: 'Overspeed',
      hardBrake: 'Hard Brake',
      hardAccel: 'Hard Accel',
      hardCorner: 'Hard Corner',
      crash: 'Crash',
      harshTotal: 'Harsh total',
      critical: 'Critical',
      totalPenalty: 'Total penalty',
      harshRiding: 'Harsh riding',
      scoredDistance: 'Scored distance',
      start: 'Start',
      end: 'End',
      inProgress: 'In progress',
    },
    payments: {
      title: 'Lease & Payments',
      leaseBalance: 'Lease Principal Balance',
      dailyRate: 'Daily Rate',
      unpaidDebts: 'Outstanding Arrears',
      weeklyGrid: 'Weekly Payment Grid',
      paymentHistory: 'Payment Transactions History',
      noPaymentsYet: 'No payment logs recorded yet.',
      collectTitle: 'Register Daily Payment',
      amount: 'Amount (RWF)',
      method: 'Payment Method',
      reference: 'Transaction Ref',
      payNow: 'Pay Scheduled Amount',
      statusPaid: 'PAID',
      statusUnpaid: 'UNPAID',
      statusPartial: 'PARTIAL',
      leaseToOwnPlan: 'Lease-to-Own Plan',
      dailyRental: 'Daily Rental Collection',
      perDay: '/ day',
      leasePrincipalPaid: 'Lease Principal Paid',
      paid: 'Paid',
      total: 'Total',
      periodSchedule: 'Payment Schedule',
      requiredPeriodContribution: 'Required Period Contribution',
      scheduleDaily: 'Daily Schedule (1 Day)',
      scheduleWeekly: 'Weekly Schedule (7 Days)',
      scheduleCustom: 'Custom Schedule ({days} Days)',
      partialReasonRequired: 'Reason for Partial Payment (Required by Fleet Admin)',
      partialReasonPlaceholder: 'e.g., Bike undergoing maintenance / half-day trip',
      partialReasonError: 'Please provide a reason why you are paying less than the required period contribution.',
    },
    deliveries: {
      title: 'Active Deliveries',
      orderDetailTitle: 'Delivery Details',
      statusPending: 'Pending',
      statusInProgress: 'In Transit',
      statusCompleted: 'Delivered',
      statusCancelled: 'Cancelled',
      pickupAddress: 'Pickup Address',
      dropoffAddress: 'Dropoff Address',
      customerName: 'Customer Name',
      customerPhone: 'Customer Phone',
      startDelivery: 'Start Delivery Route',
      completeDelivery: 'Mark Delivered',
      noDeliveries: 'No active delivery assignments found.',
      assignedOrders: 'Assigned Orders',
      pickup: 'Pickup',
      dropoff: 'Dropoff',
      customer: 'Customer',
      callCustomer: 'Call Customer',
      routeAction: 'Directions',
    },
    sos: {
      title: 'Emergency SOS Dispatch',
      alertTitle: 'Trigger Emergency Alert',
      alertDesc: 'Hold the emergency button for 3 seconds to alert your fleet dispatch center and trigger immediate assistance.',
      pressToHold: 'Press & Hold Emergency SOS',
      sending: 'Sending SOS Alert...',
      sentSuccess: '✓ Emergency Alert Sent to Dispatch!',
      emergencyContacts: 'Fleet Hotline Support',
      callSupport: 'Call Dispatcher',
      notifyContacts: 'Contacts Notified',
      reference: 'Reference',
      sendAnother: 'Send another SOS',
      tapToAlert: 'Tap to alert dispatch immediately',
      whenToUse: 'When to use SOS',
    },
    nearby: {
      title: 'Nearby Services',
      searchPlaceholder: 'Search swap stations, mechanics...',
      chargingStations: 'Battery Swap Stations',
      mechanics: 'Service & Repairs',
      hospitals: 'Medical Centers',
      police: 'Police Stations',
      noResults: 'No nearby services found matching search.',
      getDirections: 'Get Directions',
      callStation: 'Call Station',
      locationSection: 'GPS Location',
      getLocation: 'Use Current Location',
      refreshLocation: 'Refresh Location',
      gettingLocation: 'Getting location...',
    },
  },
  rw: {
    common: {
      loading: 'Kwikorera...',
      updating: 'Kuvugurura...',
      error: 'Hari ikosa ryabaye',
      retry: 'Ongera ugerageze',
      close: 'Funga',
      save: 'Bika',
      cancel: 'Bika',
      confirm: 'Emeza',
      back: 'Subira inyuma',
      none: 'Nta cyo',
      active: 'Arakora',
      inactive: 'Ntikora',
      online: 'Kuri murandasi',
      offline: 'Nta murandasi',
      copied: '✓ Byagutse',
      copy: '📋 Koporora',
      total: 'Byose',
      today: 'Uyu munsi',
      thisWeek: 'Iki cyumweru',
      viewAll: 'Reba Byose',
      submit: 'Ohereza',
      duration: 'Igihe',
      used: 'Yagutswe',
      signOut: 'Sohoka',
    },
    tabs: {
      home: 'Kaza',
      trips: 'Ingendo',
      deliveries: 'Ibipaki',
      payments: 'Kwishyura',
      sos: 'Ubutabazi',
      nearby: 'Aho uri',
      profile: 'Umwirondoro',
    },
    statusBanners: {
      offlineTitle: 'Nta murandasi uboneka',
      offlineSub: 'Genhura umurandasi wawe kugira ngo ukorane n’isibo.',
      pendingTitle: 'Ugutegereza kurangira',
      pendingSub: 'Ubuyobozi bwawe buri gukora kuri moto yawe.',
      pendingCta: 'Vugana n’ubuyobozi',
    },
    auth: {
      welcomeTitle: 'Murakaza neza',
      welcomeSub: 'Injira urebereho ingendo n’amakuru yawe.',
      identifierLabel: 'Imiyoboro ya Imeyili cyane telekome',
      identifierPlaceholder: 'andika imeyili cyangwa nimero...',
      passwordLabel: 'Ijambo ry’ibanga',
      passwordPlaceholder: 'andika ijambo ry’ibanga...',
      loginButton: 'Injira',
      loggingIn: 'Kwinjira...',
      registerLink: 'Ntubwo ufite konti? Iyandikishe',
      forgotPasswordLink: 'Wibagiwe ijambo ry’ibanga?',
      otpTitle: 'Shyiramo kode y’ubwishingizi',
      otpSub: 'Twakwoherereje kode y’imibare 6 muri imeyili/telefone.',
      otpLabel: 'Kode ya OTP',
      verifyOtp: 'Emeza & Injira',
      resendOtp: 'Ongera ubasabe kode',
      registerTitle: 'Wiyandikishe nk’umutwari',
      fullNameLabel: 'Izina ryose',
      phoneLabel: 'Nimero ya telefone',
      emailLabel: 'Imeyili (Niba uyifite)',
      fleetCodeLabel: 'Kodike y’ikigo',
      registerButton: 'Rangiza kwiyandikisha',
      hasAccountLink: 'Ufite konti tayari? Injira',
      forgotTitle: 'Guhindura ijambo ry’ibanga',
      forgotSub: 'Shyiramo telefone cyangwa imeyili uboneraho amabwiriza.',
      sendResetLink: 'Ohereza kode',
      resetTitle: 'Shyiraho ijambo gushya',
      newPasswordLabel: 'Ijambo ry’ibanga gushya',
      resetButton: 'Bika ijambo ry’ibanga',
    },
    home: {
      greeting: 'Muraho',
      safetyScore: 'Amanota y’Umutekano',
      scoreSubtitle: 'Akurikije ukuntu utwara muri iki cyumweru',
      assignedBike: 'Moto yawe',
      noBike: 'Nta moto yagenwe',
      quickActions: 'Ibyagufasha kwihuta',
      actionSos: 'Ubutabazi bwihuse',
      actionPoi: 'Stasiyo ziri hafi',
      actionPay: 'Kwishyura moto',
      actionTrips: 'Ingendo zanjye',
      recentActivity: 'Ingendo zaherutse',
      noRecentTrips: 'Nta ngendo ziremerwa mu mfashanyigisho',
      avgWeeklyScore: 'Amanota yo hagati',
      totalKmThisWeek: 'Ibirometero',
      tripsCount: 'Ingendo',
      myBikeControls: 'Ibyuma bya Moto',
      batteryStatus: 'Ubuzima bwa Batiri',
      unlock: 'Gufungura',
      lock: 'Gufunga',
      myBikeLocation: 'Aho Moto Iri',
      gpsTracking: 'Urukurikirano rwa GPS',
      trackOnLiveMap: 'Kureba ku Ikarita',
      lastTrip: 'Urugendo rwaherutse',
      coaching: 'Inyigisho n’Inama',
      coachingSubtitle: 'Inama zo kukubungabunga mu muhanda',
      recentAlerts: 'Iburira ryaherutse',
      allClear: 'Nta kibazo',
      allClearDesc: 'Nta burira buhari. Utwara neza mu muhanda.',
      bikesCount: 'Moto',
      primaryBike: 'Nyamukuru',
      alertsCount: 'Iburira',
    },
    profile: {
      title: 'Umwirondoro & Amakuru',
      languageSection: 'Ururimi / Language',
      languageEnglish: '🇬🇧 Ichongereza',
      languageKinyarwanda: '🇷🇼 Ikinyarwanda',
      accountSection: 'Amakuru ya Konti',
      fullName: 'Izina ryose',
      phone: 'Telefone',
      email: 'Imeyili',
      notSet: 'Ntabwo bishyizeho',
      assignedBikes: 'Moto Wahawe',
      noBikesAssigned: 'Nta moto urahabwa',
      activeStatus: 'Irakora',
      inactiveStatus: 'Ntikora',
      since: 'Kuva',
      scoreBreakdown: 'Imyitwarire yo mu muhanda',
      bestScore: 'Amanota meza',
      averageScore: 'Amanota yo hagati',
      worstScore: 'Amanota yo hasi',
      supportDiagnostics: 'Ubufasha & Isubyabwenge',
      systemDiagnostics: 'Ibyuma by’isibo',
      showDetails: 'Reba birambuye ▼',
      hideDetails: 'Hisha amakuru ▲',
      diagnosticsDesc: 'Niba utagira intambwe kuri moto cyangwa murandasi, abafasha bashobora kugusaba iyi kode.',
      riderUserId: 'KODE Y’UMUTWARI',
      operatingFleetId: 'KODE Y’IKIGO',
      signOut: 'Sohoka muri konti',
      toggleActiveOnline: '🟢 Ndakora & Ndi kuri murandasi',
      toggleOffline: '⚫ Nta murandasi',
    },
    trips: {
      title: 'Urutonde lwa Ingendo',
      tripDetailTitle: 'Amakuru y’Urugendo',
      filterAll: 'Ingendo zose',
      filterCompleted: 'Zarangiye',
      filterOngoing: 'Izirimo zikora',
      distance: 'Ibirometero',
      duration: 'Ighe byatwaye',
      score: 'Amanota',
      startTime: 'Yatangiye',
      endTime: 'Yarangiye',
      eventsDetected: 'Ibyaha by’umutekano',
      noEvents: 'Nta kosa ryabaye kuri uyu rugendo',
      routeMap: 'Ikarita y’urugendo',
      maxSpeed: 'Umuvuduko munini',
      avgSpeed: 'Umuvuduko yo hagati',
      harshBraking: 'Gufata feri cyane',
      harshAcceleration: 'Kwongera umuvuduko cyane',
      noTripsFound: 'Nta rugendo ruraboneka.',
      eventsSubtitle: 'Ibyaha n’ibihano',
      scoreBreakdownSubtitle: 'Imibare y’ibihano',
      overspeed: 'Umuvuduko mwinshi',
      hardBrake: 'Gufata feri cyane',
      hardAccel: 'Kwongera umuvuduko',
      hardCorner: 'Gukata ikorosi nabi',
      crash: 'Impanuka',
      harshTotal: 'Ibyaha byose',
      critical: 'Ibyaha bikabije',
      totalPenalty: 'Ibihano byose',
      harshRiding: 'Intwara nabi',
      scoredDistance: 'Ibirometero byagutswe',
      start: 'Yatangiye',
      end: 'Yarangiye',
      inProgress: 'Iracyakora',
    },
    payments: {
      title: 'Kwishyura Moto',
      leaseBalance: 'Ayasigaye kwishyurwa',
      dailyRate: 'Amafaranga y’umunsi',
      unpaidDebts: 'Amadeni abarirwa',
      weeklyGrid: 'Imbonerahamwe y’icyumweru',
      paymentHistory: 'Urutonde rw’ibyo wishyuye',
      noPaymentsYet: 'Nta mukono wo kwishyura urabarura.',
      collectTitle: 'Kwishyura umunsi',
      amount: 'Amafaranga (RWF)',
      method: 'Uburyo bwo kwishyura',
      reference: 'Inomero y’icyemezo',
      payNow: 'Ishyura Ayagenwe',
      statusPaid: 'BYISHYUWE',
      statusUnpaid: 'NTIBYISHYUWE',
      statusPartial: 'BYISHYUWE MBEYA',
      leaseToOwnPlan: 'Kwishyura Ugafata Moto',
      dailyRental: 'Ukwezi kw’Umunsi',
      perDay: 'ku munsi',
      leasePrincipalPaid: 'Ayatsinzwe mu nshingano',
      paid: 'Yishyuwe',
      total: 'Byose',
      periodSchedule: 'Gahunda yo Kwishyura',
      requiredPeriodContribution: 'Amafaranga Asabwa mu Gihe',
      scheduleDaily: 'Gahunda y’Umunsi (1 Umunsi)',
      scheduleWeekly: 'Gahunda y’Icyumweru (Iminsi 7)',
      scheduleCustom: 'Gahunda yihariye (Iminsi {days})',
      partialReasonRequired: 'Impamvu yo kwishyura igice (Isabwa na Admin)',
      partialReasonPlaceholder: 'urug. Moto yari mu garage / ikibazo cy’ubukanishi',
      partialReasonError: 'Nyamuneka tanga impamvu yatumye wishyura amafaranga atageze ku asabwa.',
    },
    deliveries: {
      title: 'Ibipaki byo gutwara',
      orderDetailTitle: 'Amakuru y’iki paki',
      statusPending: 'Birategerejwe',
      statusInProgress: 'Biri mu nzira',
      statusCompleted: 'Byashyikirijwe',
      statusCancelled: 'Byagutswe',
      pickupAddress: 'Aho gufatira',
      dropoffAddress: 'Aho gushyira',
      customerName: 'Izina ry’umukiriya',
      customerPhone: 'Telefone y’umukiriya',
      startDelivery: 'Tangira Urugendo',
      completeDelivery: 'Rangiza Gutwara',
      noDeliveries: 'Nta gipaki ufite ubu.',
      assignedOrders: 'Ibipaki watanzwe',
      pickup: 'Aho gufatira',
      dropoff: 'Aho gushyikiriza',
      customer: 'Umukiriya',
      callCustomer: 'Hamagara Umukiriya',
      routeAction: 'Yerekeza hano',
    },
    sos: {
      title: 'Ubutabazi Bwihuse (SOS)',
      alertTitle: 'Ohereza ubutabazi',
      alertDesc: 'Kanda ku butabazi igihe cy’amasegonda 3 uhe abayobozi b’ikigo ubutumwa bw’ubutabazi bwihuse.',
      pressToHold: 'Kanda ukomeze ubutabazi',
      sending: 'Buri kohereza ubutabazi...',
      sentSuccess: '✓ Ubutumwa bw’ubutabazi bwamaze koherezwa!',
      emergencyContacts: 'Telefone y’ubutabazi',
      callSupport: 'Hamagara abayobozi',
      notifyContacts: 'Abayobozi bamenyeshejwe',
      reference: 'Inomero y’Icyemezo',
      sendAnother: 'Ongera uburire',
      tapToAlert: 'Kanda uburire abayobozi',
      whenToUse: 'Igihe ukoresha ubutabazi',
    },
    nearby: {
      title: 'Ibyerekezo hafi yawe',
      searchPlaceholder: 'Shakisha stasiyo za batiri...',
      chargingStations: 'Stasiyo z’ingurane ya batiri',
      mechanics: 'Abakanishi ba moto',
      hospitals: 'Ibitaro & Ivuriro',
      police: 'Stasiyo ya Polisi',
      noResults: 'Nta byerekezo bibonetse.',
      getDirections: 'Yerekeza hano',
      callStation: 'Hamagara stasiyo',
      locationSection: 'Aho Uri ku Mapu',
      getLocation: 'Koresha Aho Uri Ubu',
      refreshLocation: 'Heza Aho Uri Ubu',
      gettingLocation: 'Buri gushaka aho uri...',
    },
  },
};
