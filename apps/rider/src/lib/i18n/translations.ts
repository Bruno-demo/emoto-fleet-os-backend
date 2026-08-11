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
    done: string;
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
    inviteCodeLabel: string;
    inviteCodePlaceholder: string;
    fullNamePlaceholder: string;
    phoneLabelFormat: string;
    phonePlaceholder: string;
    emailPlaceholder: string;
    nationalIdLabelOptional: string;
    nationalIdPlaceholder: string;
    licenseLabelOptional: string;
    licensePlaceholder: string;
    uploadDocTitle: string;
    passportPhotoTitle: string;
    passportPhotoSub: string;
    nationalIdPhotoTitle: string;
    nationalIdPhotoSub: string;
    licensePhotoTitle: string;
    licensePhotoSub: string;
    choosePhotoBtn: string;
    passwordHint: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    registering: string;
    alreadyHaveAccount: string;
    signInCredentialsSub: string;
    brandEyebrow: string;
    loginSubHeader: string;
    secureBadge: string;
    needHelpTitle: string;
    forgotAccessTitle: string;
    forgotAccessSub: string;
    otpHelpTitle: string;
    otpHelpSub: string;
    registerInviteTitle: string;
    registerInviteSub: string;
    recoveryEyebrow: string;
    recoveryTitle: string;
    recoveryDescription: string;
    checkPhoneCardTitle: string;
    checkPhoneCardSub: string;
    identifierFieldLabel: string;
    identifierFieldPlaceholder: string;
    continueButton: string;
    backToLoginButton: string;
    whatHappensNextTitle: string;
    whatHappensNextSub: string;
    step1Text: string;
    step2Text: string;
    step3Text: string;
    otpHelpEyebrow: string;
    otpHelpScreenTitle: string;
    otpHelpScreenDescription: string;
    currentSignInModeCardTitle: string;
    currentSignInModeCardSub: string;
    passwordFlowBadge: string;
    otpRule1: string;
    otpRule2: string;
    otpRule3: string;
    recoveryOptionsButton: string;
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
    staySmoothRideSafe: string;
    ridesCountThisWeek: string;
    tripsScoredThisWeek: string;
    scoreLabel: string;
    noData: string;
    scoreStrong: string;
    scoreNeedsAttention: string;
    scoreHighRisk: string;
    noScoreYet: string;
    coachingTipSpeedTitle: string;
    coachingTipSpeedDetail: string;
    coachingTipBrakeTitle: string;
    coachingTipBrakeDetail: string;
    coachingTipMomentumTitle: string;
    coachingTipMomentumDetail: string;
    coachingTipFirstRideTitle: string;
    coachingTipFirstRideDetail: string;
    coachingTipLongerTitle: string;
    coachingTipLongerDetail: string;
    coachingTipCheckTitle: string;
    coachingTipCheckDetail: string;
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
    remainingOwnership: string;
    momoTitle: string;
    momoSubtitle: string;
    selectAmount: string;
    payingPartialLabel: string;
    momoPhoneLabel: string;
    paymentReceivedTitle: string;
    paymentRecordedDesc: string;
    remainingPeriodBalance: string;
    timePassedArrears: string;
    fineArrears: string;
    overdueDays: string;
    nextDueDate: string;
    daysRemaining: string;
    weekOver: string;
    periodExpired: string;
    lockWarningTitle: string;
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
    confirmTitle: string;
    confirmDesc: string;
    confirmYes: string;
    guideCrash: string;
    guideDanger: string;
    guideTheft: string;
    guideMedical: string;
    optionalNoteTitle: string;
    optionalNoteSubtitle: string;
    messageLabel: string;
    messagePlaceholder: string;
    clearNote: string;
    notSentTitle: string;
    retrySos: string;
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
      done: 'Done',
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
      inviteCodeLabel: 'Invitation code *',
      inviteCodePlaceholder: 'e.g. invite_abcdef123456',
      fullNamePlaceholder: 'e.g. Aisha Niyonzima',
      phoneLabelFormat: 'Phone number (10 Digits) *',
      phonePlaceholder: 'e.g. 0788123456',
      emailPlaceholder: 'rider@fleet.co',
      nationalIdLabelOptional: 'National ID / Identity Number (Optional)',
      nationalIdPlaceholder: 'e.g. 1199880011223344',
      licenseLabelOptional: "Driver's License Number (Optional)",
      licensePlaceholder: 'e.g. RND-987654',
      uploadDocTitle: 'Upload Rider Verification Documents',
      passportPhotoTitle: 'Passport Photo',
      passportPhotoSub: 'Headshot photo for rider identification',
      nationalIdPhotoTitle: 'National ID Card',
      nationalIdPhotoSub: 'Front photo of your National ID or Passport',
      licensePhotoTitle: "Driver's License",
      licensePhotoSub: 'Photo of your active motorcycle driving license',
      choosePhotoBtn: '📷 Choose',
      passwordHint: 'Minimum 8 characters',
      confirmPasswordLabel: 'Confirm password *',
      confirmPasswordPlaceholder: 'Re-enter password',
      registering: 'Creating rider account...',
      alreadyHaveAccount: 'Already have an account?',
      signInCredentialsSub: 'Go back to sign in with your credentials',
      brandEyebrow: 'eMoto Fleet',
      loginSubHeader: 'Sign in with your phone and password to access your dashboard, trips, and coaching.',
      secureBadge: 'Secure',
      needHelpTitle: 'Need help?',
      forgotAccessTitle: 'Forgot access',
      forgotAccessSub: 'Reset your password or recover your account',
      otpHelpTitle: 'OTP help',
      otpHelpSub: 'Questions about password-based sign-in',
      registerInviteTitle: 'Register with invite code',
      registerInviteSub: 'Got an invite from your fleet admin? Create your account',
      recoveryEyebrow: 'Recovery',
      recoveryTitle: 'Recover your rider access',
      recoveryDescription: 'We will guide you to the safest next step without exposing technical details.',
      checkPhoneCardTitle: 'Check your rider phone',
      checkPhoneCardSub: 'Start with the phone number registered by your fleet admin.',
      identifierFieldLabel: 'Rider phone number or Email',
      identifierFieldPlaceholder: 'e.g. +250788123456 or rider@example.com',
      continueButton: 'Continue',
      backToLoginButton: 'Back to login',
      whatHappensNextTitle: 'What happens next',
      whatHappensNextSub: 'Password recovery is now self-service for your account.',
      step1Text: '1. Confirm the phone number your fleet admin registered.',
      step2Text: '2. Enter the 6-character reset token sent to your device.',
      step3Text: '3. Choose a new secure password to access your rider profile.',
      otpHelpEyebrow: 'OTP Help',
      otpHelpScreenTitle: 'This rider app signs in with phone and password',
      otpHelpScreenDescription: 'SMS OTP sign-in is not enabled in this deployment, so riders should use the password flow and fleet-assisted recovery.',
      currentSignInModeCardTitle: 'Current sign-in mode',
      currentSignInModeCardSub: 'Use the same rider phone number and password that your fleet admin issued.',
      passwordFlowBadge: 'Password flow',
      otpRule1: 'If your phone changed, ask your fleet admin to update the rider account.',
      otpRule2: 'If your password is missing, use the recovery flow to request a temporary password.',
      otpRule3: 'If login still fails, return to the login screen and confirm the full phone number format.',
      recoveryOptionsButton: 'Recovery options',
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
      staySmoothRideSafe: 'Stay smooth, ride safe',
      ridesCountThisWeek: '{count} rides this week',
      tripsScoredThisWeek: '{count} trips scored this week',
      scoreLabel: 'SCORE',
      noData: 'No data',
      scoreStrong: 'Strong week',
      scoreNeedsAttention: 'Needs attention',
      scoreHighRisk: 'High risk',
      noScoreYet: 'No score yet',
      coachingTipSpeedTitle: 'Ease off in slow zones',
      coachingTipSpeedDetail: 'Recent overspeed detected. A steadier pace protects your score.',
      coachingTipBrakeTitle: 'Smooth your braking',
      coachingTipBrakeDetail: 'Leave more room ahead to brake and accelerate progressively.',
      coachingTipMomentumTitle: 'Keep momentum',
      coachingTipMomentumDetail: 'Strong week! One more clean ride to hold the lead.',
      coachingTipFirstRideTitle: 'Start your first ride',
      coachingTipFirstRideDetail: 'Your first scored ride unlocks coaching and trends.',
      coachingTipLongerTitle: 'Ride a bit longer',
      coachingTipLongerDetail: 'A longer smooth ride gives better data for your score.',
      coachingTipCheckTitle: 'Pre-ride check',
      coachingTipCheckDetail: 'Quick tire, brake & battery check saves events later.',
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
      remainingOwnership: 'Remaining Balance to Own Bike',
      momoTitle: 'Mobile Money Collection',
      momoSubtitle: 'Prompt will be sent directly to your phone. Schedule: {schedule} — Required contribution: {amount}.',
      selectAmount: 'Select Amount (RWF)',
      payingPartialLabel: 'Paying Partial / Less than Required Period Amount',
      momoPhoneLabel: 'MoMo Phone Number',
      paymentReceivedTitle: 'Payment Received!',
      paymentRecordedDesc: '{amount} has been recorded automatically to your fleet profile.',
      remainingPeriodBalance: 'Remaining Amount for Current Period',
      timePassedArrears: 'Time-Passed Overdue Arrears',
      fineArrears: 'Pending Traffic Fine Arrears',
      overdueDays: 'Days Behind Schedule',
      nextDueDate: 'Next Scheduled Due Date',
      daysRemaining: '{days} day(s) remaining',
      weekOver: 'Current week period ends in {days} day(s)',
      periodExpired: 'Payment Period Expired',
      lockWarningTitle: 'IMMEDIATE LOCK RISK & OVERDUE WARNING',
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
      confirmTitle: 'Send emergency alert?',
      confirmDesc: 'This will notify your dispatcher immediately and may trigger emergency contact workflows. Only continue if you need urgent help.',
      confirmYes: 'Yes, send SOS',
      guideCrash: 'Crash or collision',
      guideDanger: 'Personal danger or threat',
      guideTheft: 'Theft in progress',
      guideMedical: 'Medical emergency',
      optionalNoteTitle: 'Optional Note',
      optionalNoteSubtitle: 'Help dispatch understand the situation',
      messageLabel: 'Message',
      messagePlaceholder: 'What happened? Crash, medical, unsafe stop...',
      clearNote: 'Clear',
      notSentTitle: 'SOS not sent',
      retrySos: 'Retry SOS',
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
      loading: 'Gukurura amakuru...',
      updating: 'Kuvugurura...',
      error: 'Hari ikosa ryabaye',
      retry: 'Ongera ugerageze',
      close: 'Funga',
      save: 'Bika',
      cancel: 'Kureka',
      confirm: 'Emeza',
      back: 'Subira inyuma',
      none: 'Nta cyo',
      active: 'Arakora',
      inactive: 'Ntikora',
      online: 'Kuri murandasi',
      offline: 'Nta murandasi',
      copied: '✓ Byakoporowe',
      copy: '📋 Koporora',
      total: 'Byose',
      today: 'Uyu munsi',
      thisWeek: 'Iki cyumweru',
      viewAll: 'Reba Byose',
      submit: 'Ohereza',
      duration: 'Igihe',
      used: 'Yakoreshejwe',
      signOut: 'Sohoka',
      done: 'Yego',
    },
    tabs: {
      home: 'Ahabanza',
      trips: 'Ingendo',
      deliveries: 'Ibipaki',
      payments: 'Kwishyura',
      sos: 'Ubutabazi',
      nearby: 'Ibiri Hafi',
      profile: 'Umwirondoro',
    },
    statusBanners: {
      offlineTitle: 'Nta murandasi uboneka',
      offlineSub: 'Genzura murandasi yawe no kwongera guhuza n’isibo.',
      pendingTitle: 'Konti yawe iracyatunganywa',
      pendingSub: 'Ubuyobozi burimo gutunganya amakuru ya moto yawe.',
      pendingCta: 'Vugana n’ubuyobozi',
    },
    auth: {
      welcomeTitle: 'Murakaza neza',
      welcomeSub: 'Injira urebereho ingendo n’amakuru ya moto yawe.',
      identifierLabel: 'Telefoni cyangwa Imeyili',
      identifierPlaceholder: 'Andika telefone cyangwa imeyili...',
      passwordLabel: 'Ijambo ry’ibanga',
      passwordPlaceholder: 'Andika ijambo ry’ibanga...',
      loginButton: 'Injira',
      loggingIn: 'Kwinjira...',
      registerLink: 'Ntubwo ufite konti? Iyandikishe',
      forgotPasswordLink: 'Wibagiwe ijambo ry’ibanga?',
      otpTitle: 'Shyiramo kode y’umutekano',
      otpSub: 'Twakwoherereje kode y’imibare 6 muri imeyili/telefone.',
      otpLabel: 'Kode ya OTP',
      verifyOtp: 'Emeza & Injira',
      resendOtp: 'Ongera ubasabe kode',
      registerTitle: 'Wiyandikishe nk’umutwara moto',
      fullNameLabel: 'Izina ryose',
      phoneLabel: 'Nimero ya telefone',
      emailLabel: 'Imeyili (Niba uyifite)',
      fleetCodeLabel: 'Kode y’ikigo (Fleet Code)',
      registerButton: 'Rangiza kwiyandikisha',
      hasAccountLink: 'Ufite konti tayari? Injira',
      forgotTitle: 'Guhindura ijambo ry’ibanga',
      forgotSub: 'Shyiramo telefone cyangwa imeyili uboneraho amabwiriza.',
      sendResetLink: 'Ohereza kode',
      resetTitle: 'Shyiraho ijambo ry’ibanga rishya',
      newPasswordLabel: 'Ijambo ry’ibanga rishya',
      resetButton: 'Bika ijambo ry’ibanga',
      inviteCodeLabel: 'Kode y’ubutumire *',
      inviteCodePlaceholder: 'urug. invite_abcdef123456',
      fullNamePlaceholder: 'urug. Aisha Niyonzima',
      phoneLabelFormat: 'Nimero ya telefone (Imibare 10) *',
      phonePlaceholder: 'urug. 0788123456',
      emailPlaceholder: 'umutwari@isibo.rw',
      nationalIdLabelOptional: 'Inomero y’Indangamuntu (Niba uyifite)',
      nationalIdPlaceholder: 'urug. 1199880011223344',
      licenseLabelOptional: 'Inomero ya Ruhushya rwo gutwara (Niba uyifite)',
      licensePlaceholder: 'urug. RND-987654',
      uploadDocTitle: 'Ohereza inyandiko z’umutwara moto',
      passportPhotoTitle: 'Ifoto ya Pasiporo / Umwirondoro',
      passportPhotoSub: 'Ifoto ngufi y’isura yo kukuranga',
      nationalIdPhotoTitle: 'Indangamuntu',
      nationalIdPhotoSub: 'Ifoto y’imbere y’Indangamuntu cyangwa Pasiporo',
      licensePhotoTitle: 'Ruhushya rwo gutwara moto',
      licensePhotoSub: 'Ifoto ya ruhushya rwo gutwara moto rukora',
      choosePhotoBtn: '📷 Hitamo',
      passwordHint: 'Nibura imibare cyangwa inyuguti 8',
      confirmPasswordLabel: 'Emeza ijambo ry’ibanga *',
      confirmPasswordPlaceholder: 'Ongera winjize ijambo ry’ibanga',
      registering: 'Buri kurema konti y’umutwara moto...',
      alreadyHaveAccount: 'Ufite konti tayari?',
      signInCredentialsSub: 'Subira inyuma winjire na amakuru yawe',
      brandEyebrow: 'eMoto Fleet',
      loginSubHeader: 'Injira ukoresheje telefone n’ijambo ry’ibanga ubashe kureba amakuru, ingendo n’inyigisho.',
      secureBadge: 'Bitekanye',
      needHelpTitle: 'Ukeneye ubufasha?',
      forgotAccessTitle: 'Wibagiwe ijambo ry’ibanga',
      forgotAccessSub: 'Hindura ijambo ry’ibanga cyangwa ushireho rishya',
      otpHelpTitle: 'Ubufasha bwa OTP',
      otpHelpSub: 'Ibibazo ku kwinjirana n’ijambo ry’ibanga',
      registerInviteTitle: 'Wiyandikishe ukoresheje kode y’ubutumire',
      registerInviteSub: 'Wahawe kode n’ubuyobozi bw’ikigo? Rema konti yawe',
      recoveryEyebrow: 'Gusubirana Konti',
      recoveryTitle: 'Gusubirana uburyo bwo kwinjira',
      recoveryDescription: 'Tukuganisha ku ntambwe irushijeho gutekana yo gusubirana konti yawe.',
      checkPhoneCardTitle: 'Genzura telefone yawe y’umutwara moto',
      checkPhoneCardSub: 'Tanganiraho nimero ya telefone yandikishijwe n’ubuyobozi bw’ikigo.',
      identifierFieldLabel: 'Telefone cyangwa Imeyili y’umutwara moto',
      identifierFieldPlaceholder: 'urug. 0788123456 cyangwa umutwari@isibo.rw',
      continueButton: 'Komeza',
      backToLoginButton: 'Subira kwinjira',
      whatHappensNextTitle: 'Igikurikiraho ni iki',
      whatHappensNextSub: 'Guhindura ijambo ry’ibanga rwakozwe mu buryo bwihuse kuri konti yawe.',
      step1Text: '1. Emeza nimero ya telefone yanditswe n’ubuyobozi bw’ikigo.',
      step2Text: '2. Shyiramo kode y’imibare 6 yo guhindura yoherejwe kuri telefone yawe.',
      step3Text: '3. Hitamo ijambo ry’ibanga rishya ryatekanye ubashe kwinjira muri konti yawe.',
      otpHelpEyebrow: 'Ubufasha bwa OTP',
      otpHelpScreenTitle: 'Iyi konti y’umutwara moto iwinjirana na telefone n’ijambo ry’ibanga',
      otpHelpScreenDescription: 'Kwinjira ukoresheje OTP ya SMS ntabwo bikora hano, abatwara moto bakoresha ijambo ry’ibanga n’ubufasha bw’ubuyobozi.',
      currentSignInModeCardTitle: 'Uburyo bwo kwinjira buri gukora',
      currentSignInModeCardSub: 'Koresha nimero ya telefone n’ijambo ry’ibanga wahawe n’ubuyobozi bw’ikigo.',
      passwordFlowBadge: 'Inzira y’ijambo ry’ibanga',
      otpRule1: 'Niba telefone yawe yarahindutse, saba ubuyobozi bw’ikigo kuvugurura konti yawe.',
      otpRule2: 'Niba wibagiwe ijambo ry’ibanga, koresha inzira yo gusubirana konti ubashe kubona rishya.',
      otpRule3: 'Niba kwinjira bikomeje kwanga, subira ku rupapuro rwo kwinjira ugenzure format ya telefone yawe.',
      recoveryOptionsButton: 'Uburyo bwo gusubirana konti',
    },
    home: {
      greeting: 'Muraho',
      safetyScore: 'Amanota y’Umutekano',
      scoreSubtitle: 'Akurikije uko watwaye moto muri iki cyumweru',
      assignedBike: 'Moto yawe',
      noBike: 'Nta moto yagenwe',
      quickActions: 'Ibyagufasha kwihuta',
      actionSos: 'Ubutabazi bwihuse',
      actionPoi: 'Stasiyo ziri hafi',
      actionPay: 'Kwishyura moto',
      actionTrips: 'Ingendo zanjye',
      recentActivity: 'Ingendo zaherutse',
      noRecentTrips: 'Nta ngendo ziheruka zakozwe.',
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
      coachingSubtitle: 'Inama zo kuguha umutekano mu muhanda',
      recentAlerts: 'Iburira ryaherutse',
      allClear: 'Nta kibazo',
      allClearDesc: 'Nta burira buhari. Utwara neza mu muhanda.',
      bikesCount: 'Moto',
      primaryBike: 'Nyamukuru',
      alertsCount: 'Iburira',
      staySmoothRideSafe: 'Twara neza, ugende amahoro',
      ridesCountThisWeek: 'Ingendo {count} muri iki cyumweru',
      tripsScoredThisWeek: '{count} ingendo zatsinzwe muri iki cyumweru',
      scoreLabel: 'AMANOTA',
      noData: 'Nta makuru',
      scoreStrong: 'Icyumweru cyiza',
      scoreNeedsAttention: 'Witondere umuvuduko',
      scoreHighRisk: 'Ibyago biri hejuru',
      noScoreYet: 'Nta manota aragera',
      coachingTipSpeedTitle: 'Gabhanya umuvuduko mu magendo',
      coachingTipSpeedDetail: 'Haragaragaye umuvuduko mwinshi. Genda buhoro kuzuza amanota meza.',
      coachingTipBrakeTitle: 'Gufata feri neza buhoro',
      coachingTipBrakeDetail: 'Siga umwanya Uhagije imbere yo gufata feri no kwongera umuvuduko.',
      coachingTipMomentumTitle: 'Komeza umuvuduko mwiza',
      coachingTipMomentumDetail: 'Icyumweru cyiza! Utwaye neza rimwe arusha abandi.',
      coachingTipFirstRideTitle: 'Tangira urugendo rwawe rwa mbere',
      coachingTipFirstRideDetail: 'Urugendo rwawe rwa mbere ruzaguhuza n’inyigisho n’amanota.',
      coachingTipLongerTitle: 'Twara intera ndende gato',
      coachingTipLongerDetail: 'Urugendo rwiza rurebure rutanga amakuru arushijeho ku manota yawe.',
      coachingTipCheckTitle: 'Gusuzuma moto mbele yo gutwara',
      coachingTipCheckDetail: 'Gusuzuma amapine, feri na batiri rugikubita bikurinda amakosa.',
    },
    profile: {
      title: 'Umwirondoro & Amakuru',
      languageSection: 'Ururimi / Language',
      languageEnglish: '🇬🇧 Bwongereza (English)',
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
      riderUserId: 'KODE Y’UMUTWARI WA MOTO',
      operatingFleetId: 'KODE Y’IKIGO (FLEET)',
      signOut: 'Sohoka muri konti',
      toggleActiveOnline: '🟢 Ndakora & Ndi kuri murandasi',
      toggleOffline: '⚫ Nta murandasi',
    },
    trips: {
      title: 'Urutonde rw’Ingendo',
      tripDetailTitle: 'Amakuru y’Urugendo',
      filterAll: 'Ingendo zose',
      filterCompleted: 'Zarangiye',
      filterOngoing: 'Izirimo zikora',
      distance: 'Ibirometero',
      duration: 'Igihe byatwaye',
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
      harshRiding: 'Utwara nabi',
      scoredDistance: 'Ibirometero byapimwe',
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
      statusPartial: 'BYISHYUWE IGICE',
      leaseToOwnPlan: 'Kwishyura Ugafata Moto',
      dailyRental: 'Ubwishyu bw’Umunsi (Rental)',
      perDay: 'ku munsi',
      leasePrincipalPaid: 'Aramaze kwishyurwa ku moto',
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
      remainingOwnership: 'Ayasigaye kwishyura ngo Moto ibe iyawe',
      momoTitle: 'Kwishyura na Mobile Money',
      momoSubtitle: 'Ubutumwa buza kwoherezwa kuri telefone yawe. Gahunda: {schedule} — Umusanzu usabwa: {amount}.',
      selectAmount: 'Hitamo amafaranga (RWF)',
      payingPartialLabel: 'Kwishyura igice / Munsi y’amafaranga asabwa ku gihe',
      momoPhoneLabel: 'Nimero ya telefone ya MoMo',
      paymentReceivedTitle: 'Ubwishyu bwakiriwe!',
      paymentRecordedDesc: '{amount} yishyuwe kandi yareshjwe kuri konti yawe mu kigo.',
      remainingPeriodBalance: 'Ayasigaye mu gihe cy’ubwishyu buri kugeza',
      timePassedArrears: 'Ikirarane cy’iminsi yarenze',
      fineArrears: 'Amadeni y’amande y’umuhanda',
      overdueDays: 'Iminsi yarenze ku nshingano',
      nextDueDate: 'Igihe cy’ubwishyu bukurikiyeho',
      daysRemaining: 'Hasigaye iminsi {days}',
      weekOver: 'Igihe cy’icyumweru kizarangira mu minsi {days}',
      periodExpired: 'Igihe cyo Kwishyura Cyarangiye',
      lockWarningTitle: 'IBURIRA BIKABIJE: MOTO ISHOBORA GUFUNGWA KURE',
    },
    deliveries: {
      title: 'Ibipaki byo gutwara',
      orderDetailTitle: 'Amakuru y’iki paki',
      statusPending: 'Birategerejwe',
      statusInProgress: 'Biri mu nzira',
      statusCompleted: 'Byashyikirijwe',
      statusCancelled: 'Byahagaritswe',
      pickupAddress: 'Aho gufatira',
      dropoffAddress: 'Aho gushyira',
      customerName: 'Izina ry’umukiriya',
      customerPhone: 'Telefone y’umukiriya',
      startDelivery: 'Tangira Urugendo',
      completeDelivery: 'Rangiza Gutwara',
      noDeliveries: 'Nta gipaki ufite ubu.',
      assignedOrders: 'Ibipaki wahawe',
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
      confirmTitle: 'Ohereza ubutabazi bwihuse?',
      confirmDesc: 'Iki gikorwa kirahita kimenyesha abagenzuzi n’abafasha mu buryo bwihuse. Komeza gusa niba ukeneye ubufasha bwihuse.',
      confirmYes: 'Yego, ohereza SOS',
      guideCrash: 'Impanuka cyangwa kugongana',
      guideDanger: 'Akaga cyangwa kwangizwa',
      guideTheft: 'Kwibwa kuri moto',
      guideMedical: 'Ubufasha bw’ubuzima bwihutirwa',
      optionalNoteTitle: 'Ibisobanuro by’inyongera (Bihitamo)',
      optionalNoteSubtitle: 'Fasha umugenzi gusobanukirwa uko bimeze',
      messageLabel: 'Ubutumwa',
      messagePlaceholder: 'Icyabaye? Impanuka, ubuzima, guhagarara nabi...',
      clearNote: 'Siba',
      notSentTitle: 'SOS ntiyashoboye koherezwa',
      retrySos: 'Ongera ugerageze kohereza SOS',
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
      refreshLocation: 'Kuvugurura Aho Uri',
      gettingLocation: 'Buri gushaka aho uri...',
    },
  },
};
