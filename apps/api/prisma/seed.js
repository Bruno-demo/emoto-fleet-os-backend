const { createCipheriv, createHash, randomBytes } = require('crypto');
const bcrypt = require('bcrypt');
const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEVICE_SECRET_FORMAT_VERSION = 'v1';
const LIVE_STATE_TTL_SECONDS = 60 * 60;
const DEMO_FLEET_ID = '00000000-0000-0000-0000-000000000001';
const SECOND_FLEET_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_PARTNER_ID = '00000000-0000-0000-0000-000000000201';
const DEMO_PARTNER_WEBHOOK_ID = '00000000-0000-0000-0000-000000000221';

const USER_FIXTURES = [
  {
    key: 'owner',
    role: 'OWNER',
    email: 'owner@demo.emoto',
    phone: '+250700000010',
  },
  {
    key: 'admin',
    role: 'ADMIN',
    email: 'admin@demo.emoto',
    phone: '+250700000001',
  },
  {
    key: 'dispatcher',
    role: 'DISPATCHER',
    email: 'dispatch@demo.emoto',
    phone: '+250700000002',
  },
  {
    key: 'tech',
    role: 'TECH',
    email: 'tech@demo.emoto',
    phone: '+250700000003',
  },
  {
    key: 'insurer',
    role: 'INSURER',
    email: 'insurer@demo.emoto',
    phone: '+250700000004',
  },
  {
    key: 'riderAlpha',
    role: 'RIDER',
    email: 'rider.alpha@demo.emoto',
    phone: '+250700000101',
    fullName: 'Aline Mukamana',
  },
  {
    key: 'riderBravo',
    role: 'RIDER',
    email: 'rider.bravo@demo.emoto',
    phone: '+250700000102',
    fullName: 'Jean Iradukunda',
  },
];

const BIKE_FIXTURES = [
  {
    key: 'bikeAlpha',
    label: 'Bike-001',
    plate: 'RAD-001A',
    serial: 'EMOTO-ALPHA-001',
    model: 'eMoto Courier X',
    status: 'ACTIVE',
  },
  {
    key: 'bikeBravo',
    label: 'Bike-002',
    plate: 'RAD-002B',
    serial: 'EMOTO-BRAVO-002',
    model: 'eMoto Courier X',
    status: 'ACTIVE',
  },
  {
    key: 'bikeCharlie',
    label: 'Bike-003',
    plate: 'RAD-003C',
    serial: 'EMOTO-CHARLIE-003',
    model: 'eMoto Service',
    status: 'MAINTENANCE',
  },
];

const DEVICE_FIXTURES = [
  {
    key: 'deviceAlpha',
    bikeKey: 'bikeAlpha',
    deviceUid: 'DEV-0001',
    imei: '356938035643809',
    fwVersion: '1.2.3',
    status: 'ACTIVE',
    defaultSecret: 'device-secret-0001',
    secretEnv: 'SEED_DEVICE_SECRET_ALPHA',
  },
  {
    key: 'deviceBravo',
    bikeKey: 'bikeBravo',
    deviceUid: 'DEV-0002',
    imei: '356938035643817',
    fwVersion: '1.2.3',
    status: 'ACTIVE',
    defaultSecret: 'device-secret-0002',
    secretEnv: 'SEED_DEVICE_SECRET_BRAVO',
  },
  {
    key: 'deviceCharlie',
    bikeKey: 'bikeCharlie',
    deviceUid: 'DEV-0003',
    imei: '356938035643825',
    fwVersion: '1.1.8',
    status: 'INACTIVE',
    defaultSecret: 'device-secret-0003',
    secretEnv: 'SEED_DEVICE_SECRET_CHARLIE',
  },
];

const GLOBAL_POIS = [
  {
    id: '00000000-0000-0000-0000-000000000701',
    type: 'GARAGE',
    name: 'Kigali Central Garage',
    phone: '+250700100200',
    lat: -1.944411,
    lng: 30.061882,
    address: 'KN 4 Ave, Kigali',
  },
  {
    id: '00000000-0000-0000-0000-000000000702',
    type: 'CLINIC',
    name: 'City Rider Clinic',
    phone: '+250700100201',
    lat: -1.950164,
    lng: 30.058991,
    address: 'KG 11 Ave, Kigali',
  },
];

const FLEET_POIS = [
  {
    id: '00000000-0000-0000-0000-000000000711',
    type: 'SWAP',
    name: 'Nyabugogo Battery Swap',
    phone: '+250700200301',
    lat: -1.936949,
    lng: 30.060124,
    address: 'Nyabugogo Terminal',
  },
  {
    id: '00000000-0000-0000-0000-000000000712',
    type: 'GARAGE',
    name: 'Fleet Service Yard',
    phone: '+250700200302',
    lat: -1.948551,
    lng: 30.066141,
    address: 'KG 7 Ave, Kigali',
  },
];

const CONTACT_FIXTURES = [
  {
    id: '00000000-0000-0000-0000-000000000801',
    name: 'Dispatch Desk',
    phone: '+250700300401',
    role: 'DISPATCH',
  },
  {
    id: '00000000-0000-0000-0000-000000000802',
    name: 'Operations Manager',
    phone: '+250700300402',
    role: 'MANAGER',
  },
  {
    id: '00000000-0000-0000-0000-000000000803',
    name: 'Emergency Response',
    phone: '+250700300403',
    role: 'EMERGENCY',
  },
];

const SECOND_FLEET_USER_FIXTURES = [
  {
    key: 'owner',
    role: 'OWNER',
    email: 'owner@north.demo.emoto',
    phone: '+250700000210',
  },
  {
    key: 'admin',
    role: 'ADMIN',
    email: 'admin@north.demo.emoto',
    phone: '+250700000211',
  },
  {
    key: 'dispatcher',
    role: 'DISPATCHER',
    email: 'dispatch@north.demo.emoto',
    phone: '+250700000212',
  },
  {
    key: 'tech',
    role: 'TECH',
    email: 'tech@north.demo.emoto',
    phone: '+250700000213',
  },
  {
    key: 'riderNorth',
    role: 'RIDER',
    email: 'rider.north@demo.emoto',
    phone: '+250700000214',
    fullName: 'Eric Nshimiyimana',
  },
];

const SECOND_FLEET_BIKE_FIXTURES = [
  {
    key: 'bikeNorthAlpha',
    label: 'North-001',
    plate: 'NTH-001A',
    serial: 'EMOTO-NORTH-001',
    model: 'eMoto Cargo Pro',
    status: 'ACTIVE',
  },
  {
    key: 'bikeNorthBravo',
    label: 'North-002',
    plate: 'NTH-002B',
    serial: 'EMOTO-NORTH-002',
    model: 'eMoto Cargo Pro',
    status: 'ACTIVE',
  },
];

const SECOND_FLEET_DEVICE_FIXTURES = [
  {
    key: 'deviceNorthAlpha',
    bikeKey: 'bikeNorthAlpha',
    deviceUid: 'DEV-NORTH-0001',
    imei: '356938035643833',
    fwVersion: '1.3.0',
    status: 'ACTIVE',
    defaultSecret: 'device-secret-north-0001',
    secretEnv: 'SEED_DEVICE_SECRET_NORTH_ALPHA',
  },
  {
    key: 'deviceNorthBravo',
    bikeKey: 'bikeNorthBravo',
    deviceUid: 'DEV-NORTH-0002',
    imei: '356938035643841',
    fwVersion: '1.3.0',
    status: 'ACTIVE',
    defaultSecret: 'device-secret-north-0002',
    secretEnv: 'SEED_DEVICE_SECRET_NORTH_BRAVO',
  },
];

// Derives a symmetric encryption key from the configured master secret.
function deriveMasterKey(masterKey) {
  return createHash('sha256').update(masterKey).digest();
}

// Produces a deterministic SHA256 hash used for demo secret storage.
function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex');
}

// Encrypts demo secrets so the server can verify HMAC signatures locally.
function encryptSecret(secret, masterKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveMasterKey(masterKey), iv, {
    authTagLength: 16,
  });
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    DEVICE_SECRET_FORMAT_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

// Hashes human credentials for the auth module seed accounts.
async function hashPassword(password) {
  const rounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10);
  return bcrypt.hash(password, rounds);
}

// Returns a new timestamp offset from the provided date by whole minutes.
function offsetMinutes(baseDate, minutes) {
  return new Date(baseDate.getTime() + minutes * 60 * 1000);
}

// Builds a compact square polygon around a point for zone seed data.
function buildSquarePolygon(centerLat, centerLng, halfSizeDegrees) {
  const south = round(centerLat - halfSizeDegrees, 6);
  const north = round(centerLat + halfSizeDegrees, 6);
  const west = round(centerLng - halfSizeDegrees, 6);
  const east = round(centerLng + halfSizeDegrees, 6);

  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

// Builds evenly-spaced telemetry points for one demo trip route.
function buildTripTelemetryPoints({
  deviceId,
  startTs,
  endTs,
  startLat,
  startLng,
  endLat,
  endLng,
  speeds,
  batteryStart,
  ignition = true,
}) {
  const points = [];
  const totalSteps = Math.max(speeds.length - 1, 1);

  for (let index = 0; index < speeds.length; index += 1) {
    const ratio = index / totalSteps;
    const ts = new Date(
      startTs.getTime() + (endTs.getTime() - startTs.getTime()) * ratio,
    );
    points.push({
      deviceId,
      ts,
      lat: round(interpolate(startLat, endLat, ratio), 6),
      lng: round(interpolate(startLng, endLng, ratio), 6),
      speedKph: round(speeds[index], 2),
      heading: round(85 + ratio * 40, 2),
      accelX: round(0.12 + ratio * 0.06, 4),
      accelY: round(-0.03 - ratio * 0.04, 4),
      accelZ: round(9.68 + ratio * 0.08, 4),
      batteryV: round(batteryStart - ratio * 0.6, 3),
      ignition,
    });
  }

  return points;
}

// Builds dense telemetry around a crash so evidence pack generation has context.
function buildCrashTelemetryWindow(deviceId, crashTs, centerLat, centerLng) {
  const offsets = [-120, -90, -60, -30, 0, 30, 60, 90, 120];
  const speedProfile = [36, 35, 32, 28, 6, 2, 0, 0, 0];
  const accelProfile = [
    [0.2, -0.1, 9.7],
    [0.3, -0.2, 9.8],
    [0.4, -0.4, 10.1],
    [0.5, -0.6, 10.5],
    [4.8, -3.5, 18.2],
    [0.8, -0.3, 10.2],
    [0.1, -0.1, 9.8],
    [0.1, -0.1, 9.8],
    [0.1, -0.1, 9.8],
  ];

  return offsets.map((offsetSeconds, index) => ({
    deviceId,
    ts: new Date(crashTs.getTime() + offsetSeconds * 1000),
    lat: round(centerLat + (index - 4) * 0.00005, 6),
    lng: round(centerLng + (index - 4) * 0.00004, 6),
    speedKph: speedProfile[index],
    heading: index < 5 ? 132 : 136,
    accelX: accelProfile[index][0],
    accelY: accelProfile[index][1],
    accelZ: accelProfile[index][2],
    batteryV: 51.102,
    ignition: index < 5,
  }));
}

// Rounds seeded numeric values to the same precision stored by Prisma decimals.
function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Interpolates values between two numeric endpoints for route generation.
function interpolate(start, end, ratio) {
  return start + (end - start) * ratio;
}

// Upserts the demo fleet user accounts and rider profiles.
async function upsertFleetUsers(fleetId, passwordHash, userFixtures) {
  const users = {};

  for (const fixture of userFixtures) {
    const user = await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId,
          email: fixture.email,
        },
      },
      update: {
        role: fixture.role,
        phone: fixture.phone,
        passwordHash,
        status: 'ACTIVE',
      },
      create: {
        fleetId,
        role: fixture.role,
        email: fixture.email,
        phone: fixture.phone,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    users[fixture.key] = user;

    if (fixture.role === 'RIDER') {
      await prisma.riderProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          fullName: fixture.fullName,
        },
        create: {
          userId: user.id,
          fullName: fixture.fullName,
        },
      });
    }
  }

  return users;
}

// Upserts the demo bikes used by both dashboard and rider flows.
async function upsertFleetBikes(fleetId, bikeFixtures) {
  const bikes = {};

  for (const fixture of bikeFixtures) {
    bikes[fixture.key] = await prisma.bike.upsert({
      where: {
        fleetId_label: {
          fleetId,
          label: fixture.label,
        },
      },
      update: {
        plate: fixture.plate,
        serial: fixture.serial,
        model: fixture.model,
        status: fixture.status,
      },
      create: {
        fleetId,
        label: fixture.label,
        plate: fixture.plate,
        serial: fixture.serial,
        model: fixture.model,
        status: fixture.status,
      },
    });
  }

  return bikes;
}

// Upserts demo devices with encrypted secrets for telemetry and command testing.
async function upsertFleetDevices(
  fleetId,
  bikes,
  deviceSecretMasterKey,
  deviceFixtures,
) {
  const devices = {};

  for (const fixture of deviceFixtures) {
    const deviceSecret =
      process.env[fixture.secretEnv] ??
      (fixture.key === 'deviceAlpha'
        ? process.env.SEED_DEVICE_SECRET
        : undefined) ??
      fixture.defaultSecret;

    devices[fixture.key] = await prisma.device.upsert({
      where: {
        deviceUid: fixture.deviceUid,
      },
      update: {
        fleetId,
        bikeId: bikes[fixture.bikeKey]?.id ?? null,
        imei: fixture.imei,
        fwVersion: fixture.fwVersion,
        status: fixture.status,
        secretHash: hashSecret(deviceSecret),
        secretEncrypted: encryptSecret(deviceSecret, deviceSecretMasterKey),
      },
      create: {
        fleetId,
        bikeId: bikes[fixture.bikeKey]?.id ?? null,
        imei: fixture.imei,
        deviceUid: fixture.deviceUid,
        fwVersion: fixture.fwVersion,
        status: fixture.status,
        secretHash: hashSecret(deviceSecret),
        secretEncrypted: encryptSecret(deviceSecret, deviceSecretMasterKey),
      },
    });
  }

  return devices;
}

// Clears demo-only relational data so the seed stays deterministic across reruns.
async function resetDemoFleetData(fleetId) {
  const fleetDevices = await prisma.device.findMany({
    where: {
      fleetId,
    },
    select: {
      id: true,
    },
  });
  const fleetDeviceIds = fleetDevices.map((device) => device.id);
  const incidents = await prisma.incident.findMany({
    where: {
      fleetId,
    },
    select: {
      id: true,
    },
  });
  const incidentIds = incidents.map((incident) => incident.id);

  if (incidentIds.length > 0) {
    await prisma.evidencePack.deleteMany({
      where: {
        incidentId: {
          in: incidentIds,
        },
      },
    });
  }

  await prisma.notification.deleteMany({ where: { fleetId } });
  await prisma.incident.deleteMany({ where: { fleetId } });
  await prisma.deviceCommand.deleteMany({ where: { fleetId } });
  await prisma.auditLog.deleteMany({ where: { fleetId } });
  await prisma.scoreSummary.deleteMany({ where: { fleetId } });
  await prisma.trip.deleteMany({ where: { fleetId } });
  await prisma.event.deleteMany({ where: { fleetId } });
  if (fleetDeviceIds.length > 0) {
    await prisma.telemetryPoint.deleteMany({
      where: {
        deviceId: {
          in: fleetDeviceIds,
        },
      },
    });
  }
  await prisma.bikeAssignment.deleteMany({ where: { fleetId } });
  await prisma.emergencyContact.deleteMany({ where: { fleetId } });
  await prisma.geofenceZone.deleteMany({ where: { fleetId } });
  await prisma.poi.deleteMany({ where: { fleetId } });
}

// Removes stale demo-fleet entities left behind by local tests or older seeds.
async function pruneNonSeedEntities(
  fleetId,
  userFixtures,
  bikeFixtures,
  deviceFixtures,
) {
  await prisma.device.deleteMany({
    where: {
      fleetId,
      deviceUid: {
        notIn: deviceFixtures.map((fixture) => fixture.deviceUid),
      },
    },
  });

  await prisma.bike.deleteMany({
    where: {
      fleetId,
      label: {
        notIn: bikeFixtures.map((fixture) => fixture.label),
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      fleetId,
      NOT: {
        OR: userFixtures.map((fixture) => ({
          email: fixture.email,
        })),
      },
    },
  });
}

// Seeds live bike state into Redis so the live map and lock rules work immediately.
async function seedLiveBikeStates(fleetId, liveStates) {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  });

  try {
    await redis.connect();
    const keyPattern = `live:fleet:${fleetId}:bike:*`;
    const existingKeys = await redis.keys(keyPattern);
    if (existingKeys.length > 0) {
      await redis.del(...existingKeys);
    }

    for (const state of liveStates) {
      const key = `live:fleet:${fleetId}:bike:${state.bikeId}`;
      await redis.set(
        key,
        JSON.stringify(state),
        'EX',
        LIVE_STATE_TTL_SECONDS,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`Redis live-state seed skipped: ${message}`);
  } finally {
    redis.disconnect();
  }
}

// Seeds a smaller second fleet so dashboard logins can verify fleet isolation.
async function seedSecondFleet({
  passwordHash,
  deviceSecretMasterKey,
  baseNow,
}) {
  const secondFleet = await prisma.fleet.upsert({
    where: {
      id: SECOND_FLEET_ID,
    },
    update: {
      name: 'North Ops Fleet',
      type: 'COOP',
    },
    create: {
      id: SECOND_FLEET_ID,
      name: 'North Ops Fleet',
      type: 'COOP',
    },
  });

  const users = await upsertFleetUsers(
    secondFleet.id,
    passwordHash,
    SECOND_FLEET_USER_FIXTURES,
  );
  const bikes = await upsertFleetBikes(secondFleet.id, SECOND_FLEET_BIKE_FIXTURES);
  const devices = await upsertFleetDevices(
    secondFleet.id,
    bikes,
    deviceSecretMasterKey,
    SECOND_FLEET_DEVICE_FIXTURES,
  );

  await resetDemoFleetData(secondFleet.id);
  await pruneNonSeedEntities(
    secondFleet.id,
    SECOND_FLEET_USER_FIXTURES,
    SECOND_FLEET_BIKE_FIXTURES,
    SECOND_FLEET_DEVICE_FIXTURES,
  );

  const now = new Date(baseNow.getTime());
  const tripStart = offsetMinutes(now, -95);
  const tripEnd = offsetMinutes(now, -68);
  const tripTs = offsetMinutes(now, -82);
  const weekStart = offsetMinutes(now, -7 * 24 * 60);

  await prisma.bikeAssignment.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000001201',
        fleetId: secondFleet.id,
        bikeId: bikes.bikeNorthAlpha.id,
        riderUserId: users.riderNorth.id,
        assignedAt: offsetMinutes(now, -9 * 24 * 60),
        active: true,
      },
    ],
  });

  await prisma.poi.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000001211',
        fleetId: secondFleet.id,
        type: 'GARAGE',
        name: 'North Fleet Garage',
        phone: '+250700400510',
        lat: -1.921114,
        lng: 30.103241,
        address: 'Kimisagara North Yard',
        active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000001212',
        fleetId: secondFleet.id,
        type: 'SWAP',
        name: 'North Swap Hub',
        phone: '+250700400511',
        lat: -1.926217,
        lng: 30.110311,
        address: 'Gatsata Exchange',
        active: true,
      },
    ],
  });

  await prisma.emergencyContact.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000001221',
        fleetId: secondFleet.id,
        name: 'North Dispatch',
        phone: '+250700400520',
        role: 'DISPATCH',
        active: true,
      },
    ],
  });

  await prisma.trip.create({
    data: {
      id: '00000000-0000-0000-0000-000000001231',
      fleetId: secondFleet.id,
      bikeId: bikes.bikeNorthAlpha.id,
      riderId: users.riderNorth.id,
      startTs: tripStart,
      endTs: tripEnd,
      distanceKm: 11.4,
      durationSec: 1620,
      score: 88.2,
    },
  });

  await prisma.telemetryPoint.createMany({
    data: [
      ...buildTripTelemetryPoints({
        deviceId: devices.deviceNorthAlpha.id,
        startTs: tripStart,
        endTs: tripEnd,
        startLat: -1.9294,
        startLng: 30.1021,
        endLat: -1.9192,
        endLng: 30.1118,
        speeds: [7, 18, 24, 29, 22, 15, 0],
        batteryStart: 53.1,
      }),
    ],
  });

  const northOverspeed = await prisma.event.create({
    data: {
      fleetId: secondFleet.id,
      bikeId: bikes.bikeNorthAlpha.id,
      deviceId: devices.deviceNorthAlpha.id,
      ts: tripTs,
      type: 'OVERSPEED',
      severity: 'MEDIUM',
      metaJson: {
        source: 'seed',
        speedKph: 43.2,
        speedLimitKph: 25,
        zoneName: 'Northern Market Slow Zone',
      },
    },
  });

  await prisma.scoreSummary.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000001241',
        fleetId: secondFleet.id,
        scope: 'RIDER',
        refId: users.riderNorth.id,
        periodStart: weekStart,
        periodEnd: now,
        score: 88.2,
        breakdownJson: {
          tripCount: 1,
          eventCounts: {
            OVERSPEED: 1,
            HARSH_BRAKE: 0,
            HARSH_ACCEL: 0,
            HARSH_CORNER: 0,
            CRASH: 0,
            THEFT_SUSPECTED: 0,
          },
        },
      },
      {
        id: '00000000-0000-0000-0000-000000001242',
        fleetId: secondFleet.id,
        scope: 'BIKE',
        refId: bikes.bikeNorthAlpha.id,
        periodStart: weekStart,
        periodEnd: now,
        score: 88.2,
        breakdownJson: {
          tripCount: 1,
        },
      },
      {
        id: '00000000-0000-0000-0000-000000001243',
        fleetId: secondFleet.id,
        scope: 'FLEET',
        refId: null,
        periodStart: weekStart,
        periodEnd: now,
        score: 88.2,
        breakdownJson: {
          tripCount: 1,
          eventCount: 1,
        },
      },
    ],
  });

  const liveStates = [
    {
      fleetId: secondFleet.id,
      bikeId: bikes.bikeNorthAlpha.id,
      deviceId: devices.deviceNorthAlpha.id,
      deviceUid: devices.deviceNorthAlpha.deviceUid,
      ts: new Date(now.getTime() - 12 * 1000).toISOString(),
      lat: -1.922114,
      lng: 30.108241,
      speedKph: 12.6,
      heading: 58,
      batteryV: 52.784,
      ignition: true,
    },
    {
      fleetId: secondFleet.id,
      bikeId: bikes.bikeNorthBravo.id,
      deviceId: devices.deviceNorthBravo.id,
      deviceUid: devices.deviceNorthBravo.deviceUid,
      ts: new Date(now.getTime() - 34 * 1000).toISOString(),
      lat: -1.924221,
      lng: 30.106711,
      speedKph: 0,
      heading: 41,
      batteryV: 52.117,
      ignition: false,
    },
  ];

  await seedLiveBikeStates(secondFleet.id, liveStates);

  await prisma.device.update({
    where: {
      id: devices.deviceNorthAlpha.id,
    },
    data: {
      bikeId: bikes.bikeNorthAlpha.id,
      lastSeenAt: new Date(liveStates[0].ts),
      status: 'ACTIVE',
    },
  });
  await prisma.device.update({
    where: {
      id: devices.deviceNorthBravo.id,
    },
    data: {
      bikeId: bikes.bikeNorthBravo.id,
      lastSeenAt: new Date(liveStates[1].ts),
      status: 'ACTIVE',
    },
  });

  return {
    fleetId: secondFleet.id,
    eventId: northOverspeed.id.toString(),
    counts: {
      users: SECOND_FLEET_USER_FIXTURES.length,
      bikes: SECOND_FLEET_BIKE_FIXTURES.length,
      devices: SECOND_FLEET_DEVICE_FIXTURES.length,
      trips: 1,
      events: 1,
    },
  };
}

// Creates the richer dashboard and rider demo dataset used across local apps.
async function seed() {
  const demoPassword =
    process.env.SEED_DEMO_PASSWORD ??
    process.env.SEED_ADMIN_PASSWORD ??
    'ChangeMe123!';
  const seedPartnerClientId =
    process.env.SEED_PARTNER_CLIENT_ID ?? 'partner-demo-client';
  const seedPartnerClientSecret =
    process.env.SEED_PARTNER_CLIENT_SECRET ?? 'PartnerSecret123!';
  const seedPartnerScopes =
    process.env.SEED_PARTNER_SCOPES ?? 'insurer:read webhooks:write';
  const deviceSecretMasterKey =
    process.env.DEVICE_SECRET_MASTER_KEY ??
    'change_me_device_secret_master_key_32chars';
  const partnerWebhookSecretMasterKey =
    process.env.PARTNER_WEBHOOK_SECRET_MASTER_KEY ??
    'change_me_partner_webhook_secret_master_key_32chars';
  const passwordHash = await hashPassword(demoPassword);
  const partnerClientSecretHash = await hashPassword(seedPartnerClientSecret);

  const fleet = await prisma.fleet.upsert({
    where: {
      id: DEMO_FLEET_ID,
    },
    update: {
      name: 'Demo Fleet',
      type: 'DELIVERY',
    },
    create: {
      id: DEMO_FLEET_ID,
      name: 'Demo Fleet',
      type: 'DELIVERY',
    },
  });

  const users = await upsertFleetUsers(fleet.id, passwordHash, USER_FIXTURES);
  const bikes = await upsertFleetBikes(fleet.id, BIKE_FIXTURES);
  const devices = await upsertFleetDevices(
    fleet.id,
    bikes,
    deviceSecretMasterKey,
    DEVICE_FIXTURES,
  );

  await resetDemoFleetData(fleet.id);
  await pruneNonSeedEntities(
    fleet.id,
    USER_FIXTURES,
    BIKE_FIXTURES,
    DEVICE_FIXTURES,
  );

  const partner = await prisma.partner.upsert({
    where: { id: DEMO_PARTNER_ID },
    update: {
      name: 'Demo Insurer Partner',
      status: 'ACTIVE',
    },
    create: {
      id: DEMO_PARTNER_ID,
      name: 'Demo Insurer Partner',
      status: 'ACTIVE',
    },
  });

  await prisma.partnerClient.upsert({
    where: {
      clientId: seedPartnerClientId,
    },
    update: {
      partnerId: partner.id,
      clientSecretHash: partnerClientSecretHash,
      scopes: seedPartnerScopes,
      status: 'ACTIVE',
    },
    create: {
      partnerId: partner.id,
      clientId: seedPartnerClientId,
      clientSecretHash: partnerClientSecretHash,
      scopes: seedPartnerScopes,
      status: 'ACTIVE',
    },
  });

  const partnerWebhookSecret = `partner-webhook-${seedPartnerClientId}`;
  await prisma.partnerWebhook.upsert({
    where: {
      id: DEMO_PARTNER_WEBHOOK_ID,
    },
    update: {
      partnerId: partner.id,
      url: 'https://example-insurer.invalid/emoto/webhook',
      secretHash: hashSecret(partnerWebhookSecret),
      secretEncrypted: encryptSecret(
        partnerWebhookSecret,
        partnerWebhookSecretMasterKey,
      ),
      active: false,
    },
    create: {
      id: DEMO_PARTNER_WEBHOOK_ID,
      partnerId: partner.id,
      url: 'https://example-insurer.invalid/emoto/webhook',
      secretHash: hashSecret(partnerWebhookSecret),
      secretEncrypted: encryptSecret(
        partnerWebhookSecret,
        partnerWebhookSecretMasterKey,
      ),
      active: false,
    },
  });

  await prisma.partnerFleetAccess.upsert({
    where: {
      partnerId_fleetId: {
        partnerId: partner.id,
        fleetId: fleet.id,
      },
    },
    update: {
      active: true,
    },
    create: {
      partnerId: partner.id,
      fleetId: fleet.id,
      active: true,
    },
  });

  const now = new Date();
  const weekStart = offsetMinutes(now, -7 * 24 * 60);

  const tripFixtures = [
    {
      id: '00000000-0000-0000-0000-000000000901',
      key: 'alphaLatest',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      riderKey: 'riderAlpha',
      startTs: offsetMinutes(now, -185),
      endTs: offsetMinutes(now, -153),
      distanceKm: 14.8,
      durationSec: 1920,
      score: 92.4,
    },
    {
      id: '00000000-0000-0000-0000-000000000902',
      key: 'alphaYesterday',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      riderKey: 'riderAlpha',
      startTs: offsetMinutes(now, -(24 * 60 + 210)),
      endTs: offsetMinutes(now, -(24 * 60 + 184)),
      distanceKm: 10.3,
      durationSec: 1560,
      score: 95.1,
    },
    {
      id: '00000000-0000-0000-0000-000000000903',
      key: 'alphaThreeDays',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      riderKey: 'riderAlpha',
      startTs: offsetMinutes(now, -(3 * 24 * 60 + 165)),
      endTs: offsetMinutes(now, -(3 * 24 * 60 + 141)),
      distanceKm: 9.7,
      durationSec: 1440,
      score: 90.8,
    },
    {
      id: '00000000-0000-0000-0000-000000000904',
      key: 'bravoCrash',
      bikeKey: 'bikeBravo',
      deviceKey: 'deviceBravo',
      riderKey: 'riderBravo',
      startTs: offsetMinutes(now, -260),
      endTs: offsetMinutes(now, -241),
      distanceKm: 8.2,
      durationSec: 1140,
      score: 68.3,
    },
    {
      id: '00000000-0000-0000-0000-000000000905',
      key: 'bravoOlder',
      bikeKey: 'bikeBravo',
      deviceKey: 'deviceBravo',
      riderKey: 'riderBravo',
      startTs: offsetMinutes(now, -(5 * 24 * 60 + 150)),
      endTs: offsetMinutes(now, -(5 * 24 * 60 + 120)),
      distanceKm: 12.9,
      durationSec: 1800,
      score: 81.6,
    },
  ];

  await prisma.bikeAssignment.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000601',
        fleetId: fleet.id,
        bikeId: bikes.bikeAlpha.id,
        riderUserId: users.riderAlpha.id,
        assignedAt: offsetMinutes(now, -12 * 24 * 60),
        active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000602',
        fleetId: fleet.id,
        bikeId: bikes.bikeBravo.id,
        riderUserId: users.riderBravo.id,
        assignedAt: offsetMinutes(now, -10 * 24 * 60),
        active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000603',
        fleetId: fleet.id,
        bikeId: bikes.bikeCharlie.id,
        riderUserId: users.riderAlpha.id,
        assignedAt: offsetMinutes(now, -25 * 24 * 60),
        unassignedAt: offsetMinutes(now, -18 * 24 * 60),
        active: false,
      },
    ],
  });

  for (const poi of GLOBAL_POIS) {
    await prisma.poi.upsert({
      where: {
        id: poi.id,
      },
      update: {
        fleetId: null,
        type: poi.type,
        name: poi.name,
        phone: poi.phone,
        lat: poi.lat,
        lng: poi.lng,
        address: poi.address,
        active: true,
      },
      create: {
        ...poi,
        fleetId: null,
        active: true,
      },
    });
  }

  await prisma.poi.createMany({
    data: FLEET_POIS.map((poi) => ({
      ...poi,
      fleetId: fleet.id,
      active: true,
    })),
  });

  await prisma.geofenceZone.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000751',
        fleetId: fleet.id,
        name: 'CBD Slow Zone',
        type: 'SLOW',
        geojsonPolygon: buildSquarePolygon(-1.9442, 30.0611, 0.0038),
        speedLimitKph: 30,
        active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000752',
        fleetId: fleet.id,
        name: 'Depot Parking Zone',
        type: 'PARK',
        geojsonPolygon: buildSquarePolygon(-1.9485, 30.0661, 0.0024),
        speedLimitKph: null,
        active: true,
      },
    ],
  });

  await prisma.emergencyContact.createMany({
    data: CONTACT_FIXTURES.map((contact) => ({
      ...contact,
      fleetId: fleet.id,
      active: true,
    })),
  });

  await prisma.trip.createMany({
    data: tripFixtures.map((trip) => ({
      id: trip.id,
      fleetId: fleet.id,
      bikeId: bikes[trip.bikeKey].id,
      riderId: users[trip.riderKey].id,
      startTs: trip.startTs,
      endTs: trip.endTs,
      distanceKm: trip.distanceKm,
      durationSec: trip.durationSec,
      score: trip.score,
    })),
  });

  const telemetryPoints = [
    ...buildTripTelemetryPoints({
      deviceId: devices.deviceAlpha.id,
      startTs: tripFixtures[0].startTs,
      endTs: tripFixtures[0].endTs,
      startLat: -1.9495,
      startLng: 30.0589,
      endLat: -1.9382,
      endLng: 30.0671,
      speeds: [9, 19, 26, 32, 28, 21, 0],
      batteryStart: 52.8,
    }),
    ...buildTripTelemetryPoints({
      deviceId: devices.deviceAlpha.id,
      startTs: tripFixtures[1].startTs,
      endTs: tripFixtures[1].endTs,
      startLat: -1.9464,
      startLng: 30.0623,
      endLat: -1.9347,
      endLng: 30.0561,
      speeds: [7, 16, 24, 27, 23, 18, 0],
      batteryStart: 52.4,
    }),
    ...buildTripTelemetryPoints({
      deviceId: devices.deviceAlpha.id,
      startTs: tripFixtures[2].startTs,
      endTs: tripFixtures[2].endTs,
      startLat: -1.9524,
      startLng: 30.0651,
      endLat: -1.9439,
      endLng: 30.0732,
      speeds: [8, 18, 22, 25, 21, 16, 0],
      batteryStart: 51.9,
    }),
    ...buildTripTelemetryPoints({
      deviceId: devices.deviceBravo.id,
      startTs: tripFixtures[3].startTs,
      endTs: tripFixtures[3].endTs,
      startLat: -1.9572,
      startLng: 30.0556,
      endLat: -1.9491,
      endLng: 30.0614,
      speeds: [10, 20, 31, 34, 28, 12, 0],
      batteryStart: 51.6,
    }),
    ...buildTripTelemetryPoints({
      deviceId: devices.deviceBravo.id,
      startTs: tripFixtures[4].startTs,
      endTs: tripFixtures[4].endTs,
      startLat: -1.9417,
      startLng: 30.0529,
      endLat: -1.9351,
      endLng: 30.0695,
      speeds: [8, 17, 25, 29, 24, 18, 0],
      batteryStart: 51.2,
    }),
    ...buildCrashTelemetryWindow(
      devices.deviceBravo.id,
      offsetMinutes(now, -246),
      -1.9512,
      30.0598,
    ),
  ];

  await prisma.telemetryPoint.createMany({
    data: telemetryPoints,
  });

  const eventFixtures = [
    {
      key: 'sosRecent',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      ts: offsetMinutes(now, -40),
      type: 'SOS',
      severity: 'HIGH',
      metaJson: {
        source: 'seed',
        note: 'Demo roadside assistance request',
      },
    },
    {
      key: 'alphaOverspeed',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      ts: offsetMinutes(tripFixtures[0].startTs, 11),
      type: 'OVERSPEED',
      severity: 'MEDIUM',
      metaJson: {
        source: 'seed',
        speedKph: 48.7,
        speedLimitKph: 30,
        zoneName: 'CBD Slow Zone',
      },
    },
    {
      key: 'alphaHarshAccel',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      ts: offsetMinutes(tripFixtures[0].startTs, 18),
      type: 'HARSH_ACCEL',
      severity: 'HIGH',
      metaJson: {
        source: 'seed',
        accelX: 3.9,
      },
    },
    {
      key: 'alphaHarshBrake',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      ts: offsetMinutes(tripFixtures[1].startTs, 14),
      type: 'HARSH_BRAKE',
      severity: 'HIGH',
      metaJson: {
        source: 'seed',
        accelY: -4.1,
      },
    },
    {
      key: 'alphaHarshCorner',
      bikeKey: 'bikeAlpha',
      deviceKey: 'deviceAlpha',
      ts: offsetMinutes(tripFixtures[2].startTs, 10),
      type: 'HARSH_CORNER',
      severity: 'MEDIUM',
      metaJson: {
        source: 'seed',
        lateralG: 1.2,
      },
    },
    {
      key: 'bravoOverspeed',
      bikeKey: 'bikeBravo',
      deviceKey: 'deviceBravo',
      ts: offsetMinutes(tripFixtures[3].startTs, 9),
      type: 'OVERSPEED',
      severity: 'MEDIUM',
      metaJson: {
        source: 'seed',
        speedKph: 54.4,
        speedLimitKph: 35,
      },
    },
    {
      key: 'bravoCrashOpen',
      bikeKey: 'bikeBravo',
      deviceKey: 'deviceBravo',
      ts: offsetMinutes(now, -246),
      type: 'CRASH',
      severity: 'CRITICAL',
      metaJson: {
        source: 'seed',
        gForce: 4.8,
        speedDropKph: 33,
        tiltDeg: 71,
      },
    },
    {
      key: 'bravoTheft',
      bikeKey: 'bikeBravo',
      deviceKey: 'deviceBravo',
      ts: offsetMinutes(tripFixtures[4].startTs, 22),
      type: 'THEFT_SUSPECTED',
      severity: 'HIGH',
      metaJson: {
        source: 'seed',
        ignition: false,
        rule: 'movement_while_off',
      },
    },
    {
      key: 'bravoCrashResolved',
      bikeKey: 'bikeBravo',
      deviceKey: 'deviceBravo',
      ts: offsetMinutes(now, -(6 * 24 * 60 + 210)),
      type: 'CRASH',
      severity: 'HIGH',
      metaJson: {
        source: 'seed',
        gForce: 3.7,
        speedDropKph: 24,
        tiltDeg: 54,
      },
    },
  ];

  const createdEvents = {};
  for (const fixture of eventFixtures) {
    createdEvents[fixture.key] = await prisma.event.create({
      data: {
        fleetId: fleet.id,
        bikeId: bikes[fixture.bikeKey].id,
        deviceId: devices[fixture.deviceKey].id,
        ts: fixture.ts,
        type: fixture.type,
        severity: fixture.severity,
        metaJson: fixture.metaJson,
      },
    });
  }

  await prisma.incident.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000951',
        fleetId: fleet.id,
        bikeId: bikes.bikeBravo.id,
        deviceId: devices.deviceBravo.id,
        eventId: createdEvents.bravoCrashOpen.id,
        status: 'OPEN',
        notes: 'Driver follow-up pending',
      },
      {
        id: '00000000-0000-0000-0000-000000000952',
        fleetId: fleet.id,
        bikeId: bikes.bikeBravo.id,
        deviceId: devices.deviceBravo.id,
        eventId: createdEvents.bravoCrashResolved.id,
        status: 'RESOLVED',
        acknowledgedByUserId: users.dispatcher.id,
        acknowledgedAt: offsetMinutes(now, -(6 * 24 * 60 + 205)),
        resolvedByUserId: users.admin.id,
        resolvedAt: offsetMinutes(now, -(6 * 24 * 60 + 160)),
        notes: 'Resolved after workshop inspection',
      },
    ],
  });

  const notifications = CONTACT_FIXTURES.flatMap((contact, index) => [
    {
      id: `00000000-0000-0000-0000-0000000010${index + 1}1`,
      fleetId: fleet.id,
      type: 'CRASH_ALERT',
      channel: 'SMS',
      to: contact.phone,
      payloadJson: {
        source: 'seed',
        incidentEventId: createdEvents.bravoCrashOpen.id.toString(),
        bikeLabel: bikes.bikeBravo.label,
        severity: 'CRITICAL',
      },
      status: index === 0 ? 'PENDING' : 'SENT',
      attemptCount: index === 0 ? 0 : 1,
      sentAt: index === 0 ? null : offsetMinutes(now, -243),
    },
    {
      id: `00000000-0000-0000-0000-0000000010${index + 1}2`,
      fleetId: fleet.id,
      type: 'SOS_ALERT',
      channel: 'SMS',
      to: contact.phone,
      payloadJson: {
        source: 'seed',
        eventId: createdEvents.sosRecent.id.toString(),
        bikeLabel: bikes.bikeAlpha.label,
        rider: 'Aline Mukamana',
      },
      status: 'SENT',
      attemptCount: 1,
      sentAt: offsetMinutes(now, -39),
    },
  ]);

  await prisma.notification.createMany({
    data: notifications,
  });

  await prisma.scoreSummary.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000001101',
        fleetId: fleet.id,
        scope: 'RIDER',
        refId: users.riderAlpha.id,
        periodStart: weekStart,
        periodEnd: now,
        score: 92.77,
        breakdownJson: {
          tripCount: 3,
          avgDistanceKm: 11.6,
          eventCounts: {
            OVERSPEED: 1,
            HARSH_BRAKE: 1,
            HARSH_ACCEL: 1,
            HARSH_CORNER: 1,
            CRASH: 0,
            THEFT_SUSPECTED: 0,
          },
        },
      },
      {
        id: '00000000-0000-0000-0000-000000001102',
        fleetId: fleet.id,
        scope: 'RIDER',
        refId: users.riderBravo.id,
        periodStart: weekStart,
        periodEnd: now,
        score: 74.95,
        breakdownJson: {
          tripCount: 2,
          avgDistanceKm: 10.55,
          eventCounts: {
            OVERSPEED: 1,
            HARSH_BRAKE: 0,
            HARSH_ACCEL: 0,
            HARSH_CORNER: 0,
            CRASH: 1,
            THEFT_SUSPECTED: 1,
          },
        },
      },
      {
        id: '00000000-0000-0000-0000-000000001103',
        fleetId: fleet.id,
        scope: 'BIKE',
        refId: bikes.bikeAlpha.id,
        periodStart: weekStart,
        periodEnd: now,
        score: 92.77,
        breakdownJson: {
          tripCount: 3,
          assignedRider: 'Aline Mukamana',
        },
      },
      {
        id: '00000000-0000-0000-0000-000000001104',
        fleetId: fleet.id,
        scope: 'BIKE',
        refId: bikes.bikeBravo.id,
        periodStart: weekStart,
        periodEnd: now,
        score: 74.95,
        breakdownJson: {
          tripCount: 2,
          assignedRider: 'Jean Iradukunda',
        },
      },
      {
        id: '00000000-0000-0000-0000-000000001105',
        fleetId: fleet.id,
        scope: 'FLEET',
        refId: null,
        periodStart: weekStart,
        periodEnd: now,
        score: 85.64,
        breakdownJson: {
          tripCount: tripFixtures.length,
          incidentCount: 2,
          activeBikeCount: 2,
        },
      },
    ],
  });

  const liveStates = [
    {
      fleetId: fleet.id,
      bikeId: bikes.bikeAlpha.id,
      deviceId: devices.deviceAlpha.id,
      deviceUid: devices.deviceAlpha.deviceUid,
      ts: new Date(now.getTime() - 25 * 1000).toISOString(),
      lat: -1.94461,
      lng: 30.06129,
      speedKph: 0,
      heading: 92,
      batteryV: 52.231,
      ignition: false,
    },
    {
      fleetId: fleet.id,
      bikeId: bikes.bikeBravo.id,
      deviceId: devices.deviceBravo.id,
      deviceUid: devices.deviceBravo.deviceUid,
      ts: new Date(now.getTime() - 8 * 1000).toISOString(),
      lat: -1.95087,
      lng: 30.05954,
      speedKph: 21.8,
      heading: 131,
      batteryV: 51.046,
      ignition: true,
    },
  ];

  await seedLiveBikeStates(fleet.id, liveStates);

  await prisma.device.update({
    where: {
      id: devices.deviceAlpha.id,
    },
    data: {
      bikeId: bikes.bikeAlpha.id,
      lastSeenAt: new Date(liveStates[0].ts),
      status: 'ACTIVE',
    },
  });
  await prisma.device.update({
    where: {
      id: devices.deviceBravo.id,
    },
    data: {
      bikeId: bikes.bikeBravo.id,
      lastSeenAt: new Date(liveStates[1].ts),
      status: 'ACTIVE',
    },
  });
  await prisma.device.update({
    where: {
      id: devices.deviceCharlie.id,
    },
    data: {
      bikeId: bikes.bikeCharlie.id,
      lastSeenAt: offsetMinutes(now, -24 * 60),
      status: 'INACTIVE',
    },
  });

  const secondFleetPassword =
    process.env.SEED_SECOND_FLEET_PASSWORD ?? 'FleetTwo123!';
  const secondFleetPasswordHash = await hashPassword(secondFleetPassword);
  const secondFleetSummary = await seedSecondFleet({
    passwordHash: secondFleetPasswordHash,
    deviceSecretMasterKey,
    baseNow: now,
  });

  console.log(
    JSON.stringify(
      {
        fleets: [
          {
            fleetId: fleet.id,
            name: 'Demo Fleet',
            counts: {
              users: USER_FIXTURES.length,
              bikes: BIKE_FIXTURES.length,
              devices: DEVICE_FIXTURES.length,
              trips: tripFixtures.length,
              events: eventFixtures.length,
              incidents: 2,
              pois: GLOBAL_POIS.length + FLEET_POIS.length,
            },
          },
          {
            fleetId: secondFleetSummary.fleetId,
            name: 'North Ops Fleet',
            counts: secondFleetSummary.counts,
          },
        ],
        seedVersion: 'dashboard-rider-v1',
      },
      null,
      2,
    ),
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
