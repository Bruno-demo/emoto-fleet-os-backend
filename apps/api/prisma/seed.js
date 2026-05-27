const { createCipheriv, createHash, randomBytes } = require('crypto');
const bcrypt = require('bcrypt');
const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: seed.js must not run in production (NODE_ENV=production)');
  process.exit(1);
}

const prisma = new PrismaClient();

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Constants
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEVICE_SECRET_FORMAT_VERSION = 'v1';
const LIVE_STATE_TTL_SECONDS = 60 * 60;

const DEMO_FLEET_ID   = '00000000-0000-0000-0000-000000000001';
const SECOND_FLEET_ID = '00000000-0000-0000-0000-000000000002';
const THIRD_FLEET_ID  = '00000000-0000-0000-0000-000000000003';

const DEMO_PARTNER_ID         = '00000000-0000-0000-0000-000000000201';
const SECOND_PARTNER_ID       = '00000000-0000-0000-0000-000000000202';
const DEMO_PARTNER_WEBHOOK_ID = '00000000-0000-0000-0000-000000000221';

// Fixed IDs for Postman E2E tests (bikes & incidents)
const DEMO_BIKE_1_ID             = '00000000-0000-0000-0000-000000000101';
const SOUTH_BIKE_1_ID            = '00000000-0000-0000-0000-000000000103';
const DEMO_RESOLVED_INCIDENT_ID  = '00000000-0000-0000-0000-000000000301';
const DEMO_OPEN_INCIDENT_ID      = '00000000-0000-0000-0000-000000000302';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reference Data: Kigali Geography & Rwandan Names
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const KIGALI_AREAS = [
  { name: 'Nyarugenge CBD',  lat: -1.9440, lng: 30.0619 },
  { name: 'Kimihurura',      lat: -1.9533, lng: 30.0928 },
  { name: 'Kacyiru',         lat: -1.9382, lng: 30.0814 },
  { name: 'Nyamirambo',      lat: -1.9644, lng: 30.0474 },
  { name: 'Gikondo',         lat: -1.9601, lng: 30.0807 },
  { name: 'Remera',          lat: -1.9527, lng: 30.1093 },
  { name: 'Kimironko',       lat: -1.9428, lng: 30.1211 },
  { name: 'Nyabugogo',       lat: -1.9369, lng: 30.0601 },
  { name: 'Gatsata',         lat: -1.9200, lng: 30.1100 },
  { name: 'Kicukiro',        lat: -1.9731, lng: 30.0922 },
  { name: 'Kanombe',         lat: -1.9687, lng: 30.1305 },
  { name: 'Gisozi',          lat: -1.9273, lng: 30.0764 },
  { name: 'Kibagabaga',      lat: -1.9367, lng: 30.1011 },
  { name: 'Kisimenti',       lat: -1.9519, lng: 30.0759 },
  { name: 'Rwandex',         lat: -1.9589, lng: 30.0657 },
  { name: 'Muhima',          lat: -1.9414, lng: 30.0548 },
  { name: 'Kinyinya',        lat: -1.9180, lng: 30.1015 },
  { name: 'Kagugu',          lat: -1.9240, lng: 30.0890 },
  { name: 'Gatenga',         lat: -1.9722, lng: 30.0764 },
  { name: 'Niboye',          lat: -1.9784, lng: 30.0993 },
  { name: 'Masaka',          lat: -1.9850, lng: 30.1120 },
  { name: 'Rusororo',        lat: -1.9060, lng: 30.1230 },
  { name: 'Kabuga',          lat: -1.9580, lng: 30.1440 },
  { name: 'Kanogo',          lat: -1.9340, lng: 30.0460 },
  { name: 'Biryogo',         lat: -1.9560, lng: 30.0530 },
];

const FIRST_NAMES = [
  'Aline', 'Jean', 'Eric', 'Patrick', 'Emmanuel', 'Diane', 'Claude', 'Grace',
  'Joseph', 'Sandrine', 'David', 'Josiane', 'Samuel', 'Esperance', 'Innocent',
  'Pascaline', 'Fabrice', 'Marie', 'Olivier', 'Vestine', 'Thierry', 'Consolee',
  'Michel', 'Beata', 'Robert', 'Jeannette', 'Frank', 'Yvonne', 'Alex', 'Dative',
  'Pacifique', 'Kevin', 'Aimable', 'Gervais', 'Uwase',
];

const LAST_NAMES = [
  'Mukamana', 'Iradukunda', 'Nshimiyimana', 'Habimana', 'Uwimana', 'Niyonzima',
  'Mugisha', 'Ndagijimana', 'Nsengimana', 'Hakizimana', 'Tuyishime', 'Muhire',
  'Bizimana', 'Kamanzi', 'Mutabazi', 'Rugamba', 'Ingabire', 'Ishimwe', 'Manzi',
  'Uwase', 'Uwineza', 'Munyaneza', 'Gasana', 'Sibomana', 'Kwizera', 'Nzabonimpa',
  'Umutoni', 'Habineza', 'Mukamusoni', 'Hirwa', 'Nyirahabimana', 'Twizere',
  'Cyiza', 'Gashumba', 'Ndayisaba',
];

const BIKE_MODELS = [
  'eMoto Courier X', 'eMoto Courier S', 'eMoto Cargo Pro',
  'eMoto City Lite', 'eMoto Service', 'eMoto Express',
];

const FW_VERSIONS = ['1.0.9', '1.1.0', '1.1.8', '1.2.3', '1.3.0', '1.3.1', '1.4.0'];

const EVENT_TYPES = [
  'OVERSPEED', 'SPEED_LIMIT_VIOLATION', 'SCHOOL_ZONE_SPEED', 'HOSPITAL_ZONE_SPEED',
  'MARKET_ZONE_SPEED', 'HARSH_BRAKE', 'HARSH_ACCEL', 'HARSH_CORNER',
  'CRASH', 'THEFT_SUSPECTED', 'SOS',
];

const INCIDENT_EVENT_TYPES = ['CRASH', 'THEFT_SUSPECTED', 'SOS'];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper Functions: Crypto & Hashing
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function deriveMasterKey(masterKey) {
  return createHash('sha256').update(masterKey).digest();
}

function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex');
}

function encryptSecret(secret, masterKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveMasterKey(masterKey), iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [DEVICE_SECRET_FORMAT_VERSION, iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

async function hashPassword(password) {
  const rounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
  return bcrypt.hash(password, rounds);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper Functions: Date, Math, Geometry
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function offsetMinutes(baseDate, minutes) {
  return new Date(baseDate.getTime() + minutes * 60 * 1000);
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function interpolate(start, end, ratio) {
  return start + (end - start) * ratio;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickArea() {
  return pick(KIGALI_AREAS);
}

function jitter(value, range) {
  return value + (Math.random() - 0.5) * 2 * range;
}

function randomUuidNonce() {
  const hex = randomBytes(16).toString('hex');
  return hex.slice(0,8) + '-' + hex.slice(8,12) + '-4' + hex.slice(13,16) + '-8' + hex.slice(17,20) + '-' + hex.slice(20,32);
}

function buildSquarePolygon(centerLat, centerLng, halfSizeDegrees) {
  const south = round(centerLat - halfSizeDegrees, 6);
  const north = round(centerLat + halfSizeDegrees, 6);
  const west  = round(centerLng - halfSizeDegrees, 6);
  const east  = round(centerLng + halfSizeDegrees, 6);
  return {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper Functions: Telemetry Generation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildTripTelemetryPoints(opts) {
  const points = [];
  const totalSteps = Math.max(opts.speeds.length - 1, 1);
  for (let i = 0; i < opts.speeds.length; i++) {
    const ratio = i / totalSteps;
    const ts = new Date(opts.startTs.getTime() + (opts.endTs.getTime() - opts.startTs.getTime()) * ratio);
    points.push({
      deviceId: opts.deviceId, ts: ts,
      lat: round(interpolate(opts.startLat, opts.endLat, ratio), 6),
      lng: round(interpolate(opts.startLng, opts.endLng, ratio), 6),
      speedKph: round(opts.speeds[i], 2),
      heading: round(45 + ratio * 120 + Math.random() * 20, 2),
      accelX: round(0.12 + ratio * 0.06 + (Math.random() - 0.5) * 0.2, 4),
      accelY: round(-0.03 - ratio * 0.04 + (Math.random() - 0.5) * 0.15, 4),
      accelZ: round(9.68 + ratio * 0.08 + (Math.random() - 0.5) * 0.1, 4),
      batteryV: round((opts.batteryStart || 50) - ratio * 0.6, 3),
      ignition: opts.ignition !== false,
    });
  }
  return points;
}

function buildCrashTelemetryWindow(deviceId, crashTs, centerLat, centerLng) {
  const offsets   = [-120, -90, -60, -30, 0, 30, 60, 90, 120];
  const speedProf = [36, 35, 32, 28, 6, 2, 0, 0, 0];
  const accelProf = [
    [0.2,-0.1,9.7],[0.3,-0.2,9.8],[0.4,-0.4,10.1],[0.5,-0.6,10.5],
    [4.8,-3.5,18.2],[0.8,-0.3,10.2],[0.1,-0.1,9.8],[0.1,-0.1,9.8],[0.1,-0.1,9.8],
  ];
  return offsets.map(function(o, i) {
    return {
      deviceId: deviceId,
      ts: new Date(crashTs.getTime() + o * 1000),
      lat: round(centerLat + (i - 4) * 0.00005, 6),
      lng: round(centerLng + (i - 4) * 0.00004, 6),
      speedKph: speedProf[i],
      heading: i < 5 ? 132 : 136,
      accelX: accelProf[i][0], accelY: accelProf[i][1], accelZ: accelProf[i][2],
      batteryV: 51.1,
      ignition: i < 5,
    };
  });
}

function generateSpeedProfile(count) {
  const profile = [round(5 + Math.random() * 8, 1)];
  for (let i = 1; i < count - 1; i++) {
    profile.push(round(15 + Math.random() * 30, 1));
  }
  profile.push(0);
  return profile;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fixture Generators
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function generateUserFixtures(domain, counts) {
  const fixtures = [];
  let phoneIdx = 0;
  const basePhone = domain === 'demo.emoto' ? 700000 : domain === 'north.demo.emoto' ? 700100 : 700200;

  function addRole(role, count, prefix) {
    for (let i = 1; i <= count; i++) {
      phoneIdx++;
      const key = count === 1 ? prefix : prefix + i;
      const emailPrefix = count === 1 ? prefix : prefix + '.' + String(i).padStart(2, '0');
      const fixture = {
        key: key,
        role: role,
        email: emailPrefix + '@' + domain,
        phone: '+250' + (basePhone + phoneIdx),
      };
      if (role === 'RIDER') {
        const fi = (phoneIdx * 7 + 3) % FIRST_NAMES.length;
        const li = (phoneIdx * 11 + 5) % LAST_NAMES.length;
        fixture.fullName = FIRST_NAMES[fi] + ' ' + LAST_NAMES[li];
      }
      fixtures.push(fixture);
    }
  }

  addRole('OWNER', counts.owner || 1, 'owner');
  addRole('ADMIN', counts.admin || 1, 'admin');
  addRole('DISPATCHER', counts.dispatcher || 1, 'dispatcher');
  addRole('TECH', counts.tech || 1, 'tech');
  if (counts.insurer) addRole('INSURER', counts.insurer, 'insurer');
  addRole('RIDER', counts.rider || 1, 'rider');

  return fixtures;
}

function generateBikeFixtures(prefix, count, fixedIds) {
  fixedIds = fixedIds || {};
  const fixtures = [];
  for (let i = 1; i <= count; i++) {
    const idx = String(i).padStart(3, '0');
    let status = 'ACTIVE';
    if (i > count - 2) status = 'RETIRED';
    else if (i > count - 5) status = 'MAINTENANCE';
    const fixture = {
      key: 'bike' + prefix + i,
      label: prefix + '-' + idx,
      plate: prefix.substring(0,3).toUpperCase() + '-' + idx + String.fromCharCode(65 + (i % 26)),
      serial: 'EMOTO-' + prefix.toUpperCase() + '-' + idx,
      model: BIKE_MODELS[i % BIKE_MODELS.length],
      status: status,
    };
    if (fixedIds[i]) fixture.id = fixedIds[i];
    fixtures.push(fixture);
  }
  return fixtures;
}

function generateDeviceFixtures(prefix, bikeFixtures) {
  return bikeFixtures.map(function(bike, i) {
    const idx = String(i + 1).padStart(3, '0');
    let status = 'ACTIVE';
    if (bike.status === 'RETIRED') status = 'RETIRED';
    else if (bike.status === 'MAINTENANCE') status = 'INACTIVE';
    else if (i > 0 && i % 15 === 0) status = 'INACTIVE';
    const imeiBase = prefix === 'Demo' ? 40000 : prefix === 'North' ? 40100 : 40200;
    return {
      key: 'device' + prefix + (i + 1),
      bikeKey: bike.key,
      deviceUid: 'DEV-' + prefix.toUpperCase().substring(0,1) + '-' + idx,
      imei: '3569380356' + String(imeiBase + i).padStart(5, '0'),
      fwVersion: FW_VERSIONS[i % FW_VERSIONS.length],
      status: status,
      defaultSecret: 'device-secret-' + prefix.toLowerCase() + '-' + idx,
    };
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Upsert Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function upsertFleetUsers(fleetId, passwordHash, userFixtures) {
  const users = {};
  for (let f = 0; f < userFixtures.length; f++) {
    const fixture = userFixtures[f];
    const user = await prisma.user.upsert({
      where: { fleetId_email: { fleetId: fleetId, email: fixture.email } },
      update: { role: fixture.role, phone: fixture.phone, passwordHash: passwordHash, status: 'ACTIVE' },
      create: { fleetId: fleetId, role: fixture.role, email: fixture.email, phone: fixture.phone, passwordHash: passwordHash, status: 'ACTIVE' },
    });
    users[fixture.key] = user;
    if (fixture.role === 'RIDER' && fixture.fullName) {
      await prisma.riderProfile.upsert({
        where: { userId: user.id },
        update: { fullName: fixture.fullName },
        create: { userId: user.id, fullName: fixture.fullName },
      });
    }
  }
  return users;
}

async function upsertFleetBikes(fleetId, bikeFixtures) {
  const bikes = {};
  for (let f = 0; f < bikeFixtures.length; f++) {
    const fixture = bikeFixtures[f];
    // If fixture has a fixed id, ensure the record uses that id
    if (fixture.id) {
      const existing = await prisma.bike.findUnique({ where: { fleetId_label: { fleetId: fleetId, label: fixture.label } } });
      if (existing && existing.id !== fixture.id) {
        // Reassign devices to avoid FK constraint, then delete old bike
        await prisma.device.updateMany({ where: { bikeId: existing.id }, data: { bikeId: null } });
        await prisma.bike.delete({ where: { id: existing.id } });
      }
    }
    const createData = { fleetId: fleetId, label: fixture.label, plate: fixture.plate, serial: fixture.serial, model: fixture.model, status: fixture.status };
    if (fixture.id) createData.id = fixture.id;
    bikes[fixture.key] = await prisma.bike.upsert({
      where: { fleetId_label: { fleetId: fleetId, label: fixture.label } },
      update: { plate: fixture.plate, serial: fixture.serial, model: fixture.model, status: fixture.status },
      create: createData,
    });
  }
  return bikes;
}

async function upsertFleetDevices(fleetId, bikes, masterKey, deviceFixtures) {
  const devices = {};
  for (let f = 0; f < deviceFixtures.length; f++) {
    const fixture = deviceFixtures[f];
    const secret = fixture.defaultSecret;
    const bikeId = bikes[fixture.bikeKey] ? bikes[fixture.bikeKey].id : null;
    devices[fixture.key] = await prisma.device.upsert({
      where: { deviceUid: fixture.deviceUid },
      update: {
        fleetId: fleetId, bikeId: bikeId,
        imei: fixture.imei, fwVersion: fixture.fwVersion, status: fixture.status,
        secretHash: hashSecret(secret), secretEncrypted: encryptSecret(secret, masterKey),
      },
      create: {
        fleetId: fleetId, bikeId: bikeId,
        imei: fixture.imei, deviceUid: fixture.deviceUid,
        fwVersion: fixture.fwVersion, status: fixture.status,
        secretHash: hashSecret(secret), secretEncrypted: encryptSecret(secret, masterKey),
      },
    });
  }
  return devices;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reset & Prune
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function resetFleetData(fleetId) {
  const devIds = (await prisma.device.findMany({ where: { fleetId: fleetId }, select: { id: true } })).map(function(d) { return d.id; });
  const incIds = (await prisma.incident.findMany({ where: { fleetId: fleetId }, select: { id: true } })).map(function(i) { return i.id; });
  if (incIds.length > 0) await prisma.evidencePack.deleteMany({ where: { incidentId: { in: incIds } } });
  await prisma.notification.deleteMany({ where: { fleetId: fleetId } });
  await prisma.incident.deleteMany({ where: { fleetId: fleetId } });
  await prisma.deviceCommand.deleteMany({ where: { fleetId: fleetId } });
  await prisma.auditLog.deleteMany({ where: { fleetId: fleetId } });
  await prisma.scoreSummary.deleteMany({ where: { fleetId: fleetId } });
  await prisma.trip.deleteMany({ where: { fleetId: fleetId } });
  await prisma.event.deleteMany({ where: { fleetId: fleetId } });
  if (devIds.length > 0) await prisma.telemetryPoint.deleteMany({ where: { deviceId: { in: devIds } } });
  await prisma.bikeAssignment.deleteMany({ where: { fleetId: fleetId } });
  await prisma.emergencyContact.deleteMany({ where: { fleetId: fleetId } });
  await prisma.geofenceZone.deleteMany({ where: { fleetId: fleetId } });
  await prisma.poi.deleteMany({ where: { fleetId: fleetId } });
  await prisma.registrationInvite.deleteMany({ where: { fleetId: fleetId } });
}

async function pruneNonSeedEntities(fleetId, userFixtures, bikeFixtures, deviceFixtures) {
  await prisma.device.deleteMany({
    where: { fleetId: fleetId, deviceUid: { notIn: deviceFixtures.map(function(f) { return f.deviceUid; }) } },
  });
  await prisma.bike.deleteMany({
    where: { fleetId: fleetId, label: { notIn: bikeFixtures.map(function(f) { return f.label; }) } },
  });
  await prisma.user.deleteMany({
    where: { fleetId: fleetId, NOT: { OR: userFixtures.map(function(f) { return { email: f.email }; }) } },
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Redis Live State
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function seedLiveBikeStates(fleetId, liveStates) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000 });
  try {
    await redis.connect();
    const existing = await redis.keys('live:fleet:' + fleetId + ':bike:*');
    if (existing.length > 0) await redis.del(existing);
    for (let s = 0; s < liveStates.length; s++) {
      const state = liveStates[s];
      await redis.set(
        'live:fleet:' + fleetId + ':bike:' + state.bikeId,
        JSON.stringify(state),
        'EX', LIVE_STATE_TTL_SECONDS,
      );
    }
  } catch (err) {
    console.warn('  Warning: Redis live-state seed skipped: ' + (err instanceof Error ? err.message : 'unknown'));
  } finally {
    redis.disconnect();
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Seed
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function seed() {
  console.log('========================================');
  console.log('  eMoto Fleet OS - Comprehensive Seed');
  console.log('========================================\n');
  const now = new Date();

  // Passwords
  const demoPassword  = process.env.SEED_DEMO_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const northPassword = process.env.SEED_SECOND_FLEET_PASSWORD || 'FleetTwo123!';
  const southPassword = process.env.SEED_THIRD_FLEET_PASSWORD || 'FleetThree123!';
  const deviceSecretMasterKey = process.env.DEVICE_SECRET_MASTER_KEY || 'change_me_device_secret_master_key_32chars';
  const partnerWebhookSecretMasterKey = process.env.PARTNER_WEBHOOK_SECRET_MASTER_KEY || 'change_me_partner_webhook_secret_master_key_32chars';

  const demoHash  = await hashPassword(demoPassword);
  const northHash = await hashPassword(northPassword);
  const southHash = await hashPassword(southPassword);

  // Fleet configurations
  const fleetConfigs = [
    {
      id: DEMO_FLEET_ID, name: 'Demo Fleet', type: 'DELIVERY', plan: 'DEMO',
      passwordHash: demoHash, domain: 'demo.emoto',
      userCounts: { owner: 1, admin: 3, dispatcher: 4, tech: 3, insurer: 1, rider: 13 },
      bikePrefix: 'Demo', bikeCount: 30,
      fixedBikeIds: { 1: DEMO_BIKE_1_ID },
      tripCount: 55, eventCount: 75,
      zoneCount: 25, poiCount: 22, contactCount: 6, commandCount: 30, notifCount: 30,
      auditCount: 30, inviteCount: 8,
    },
    {
      id: SECOND_FLEET_ID, name: 'North Ops Fleet', type: 'COOP', plan: 'PREMIUM',
      passwordHash: northHash, domain: 'north.demo.emoto',
      userCounts: { owner: 1, admin: 2, dispatcher: 2, tech: 2, rider: 10 },
      bikePrefix: 'North', bikeCount: 20,
      tripCount: 25, eventCount: 35,
      zoneCount: 18, poiCount: 16, contactCount: 5, commandCount: 18, notifCount: 18,
      auditCount: 15, inviteCount: 5,
    },
    {
      id: THIRD_FLEET_ID, name: 'South Metro Fleet', type: 'DELIVERY', plan: 'PREMIUM',
      passwordHash: southHash, domain: 'south.demo.emoto',
      userCounts: { owner: 1, admin: 1, dispatcher: 2, tech: 1, rider: 8 },
      bikePrefix: 'South', bikeCount: 12,
      fixedBikeIds: { 1: SOUTH_BIKE_1_ID },
      tripCount: 18, eventCount: 22,
      zoneCount: 14, poiCount: 14, contactCount: 4, commandCount: 12, notifCount: 12,
      auditCount: 10, inviteCount: 4,
    },
  ];

  const totals = {
    users: 0, bikes: 0, devices: 0, trips: 0, events: 0, incidents: 0,
    zones: 0, pois: 0, scores: 0, notifications: 0, commands: 0,
    assignments: 0, auditLogs: 0, telemetry: 0, contacts: 0, invites: 0,
    evidencePacks: 0,
  };

  // Delete global POIs before re-seeding
  await prisma.poi.deleteMany({ where: { fleetId: null } });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SEED EACH FLEET
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  for (let fi = 0; fi < fleetConfigs.length; fi++) {
    const cfg = fleetConfigs[fi];
    console.log('\n-- ' + cfg.name + ' --');

    // Upsert fleet
    await prisma.fleet.upsert({
      where: { id: cfg.id },
      update: { name: cfg.name, type: cfg.type, plan: cfg.plan, subscriptionStatus: 'ACTIVE' },
      create: { id: cfg.id, name: cfg.name, type: cfg.type, plan: cfg.plan, subscriptionStatus: 'ACTIVE' },
    });

    // Generate fixtures
    const userFixtures   = generateUserFixtures(cfg.domain, cfg.userCounts);
    const bikeFixtures   = generateBikeFixtures(cfg.bikePrefix, cfg.bikeCount, cfg.fixedBikeIds);
    const deviceFixtures = generateDeviceFixtures(cfg.bikePrefix, bikeFixtures);

    // Upsert core entities
    const users   = await upsertFleetUsers(cfg.id, cfg.passwordHash, userFixtures);
    const bikes   = await upsertFleetBikes(cfg.id, bikeFixtures);
    const devices = await upsertFleetDevices(cfg.id, bikes, deviceSecretMasterKey, deviceFixtures);

    // Reset relational data & prune stale entities
    await resetFleetData(cfg.id);
    await pruneNonSeedEntities(cfg.id, userFixtures, bikeFixtures, deviceFixtures);

    // Classify keys
    const riderKeys      = userFixtures.filter(function(f) { return f.role === 'RIDER'; }).map(function(f) { return f.key; });
    const activeBikeKeys = bikeFixtures.filter(function(f) { return f.status === 'ACTIVE'; }).map(function(f) { return f.key; });
    const activeDevKeys  = deviceFixtures.filter(function(f) { return f.status === 'ACTIVE'; }).map(function(f) { return f.key; });
    const dispatchKeys   = userFixtures.filter(function(f) { return f.role === 'DISPATCHER'; }).map(function(f) { return f.key; });
    const adminKeys      = userFixtures.filter(function(f) { return f.role === 'ADMIN' || f.role === 'OWNER'; }).map(function(f) { return f.key; });

    // â”€â”€ Bike Assignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const assignData = [];
    const assignLimit = Math.min(riderKeys.length, activeBikeKeys.length);
    for (let i = 0; i < assignLimit; i++) {
      assignData.push({
        fleetId: cfg.id,
        bikeId: bikes[activeBikeKeys[i]].id,
        riderUserId: users[riderKeys[i]].id,
        assignedAt: offsetMinutes(now, -(10 + i * 2) * 24 * 60),
        active: true,
      });
    }
    // Historical (inactive)
    const histLimit = Math.min(riderKeys.length, activeBikeKeys.length, 10);
    for (let i = 0; i < histLimit; i++) {
      const otherBike = activeBikeKeys[(i + 3) % activeBikeKeys.length];
      assignData.push({
        fleetId: cfg.id,
        bikeId: bikes[otherBike].id,
        riderUserId: users[riderKeys[i]].id,
        assignedAt: offsetMinutes(now, -(60 + i * 5) * 24 * 60),
        unassignedAt: offsetMinutes(now, -(30 + i * 3) * 24 * 60),
        active: false,
      });
    }
    await prisma.bikeAssignment.createMany({ data: assignData });
    totals.assignments += assignData.length;
    console.log('   ' + assignData.length + ' bike assignments');

    // â”€â”€ POIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const poiTypes = ['GARAGE', 'SWAP', 'CLINIC', 'OTHER'];
    const poiData = [];
    const poiNameMap = { GARAGE: 'Service Center', SWAP: 'Battery Swap', CLINIC: 'Rider Clinic', OTHER: 'Charging Hub' };
    const phoneBase = cfg.bikePrefix === 'Demo' ? 0 : cfg.bikePrefix === 'North' ? 100 : 200;
    for (let i = 0; i < cfg.poiCount; i++) {
      const area = KIGALI_AREAS[i % KIGALI_AREAS.length];
      const pType = poiTypes[i % poiTypes.length];
      poiData.push({
        fleetId: (cfg.id === DEMO_FLEET_ID && i < 4) ? null : cfg.id,
        type: pType,
        name: area.name + ' ' + poiNameMap[pType],
        phone: '+25078' + String(8000 + i + phoneBase).padStart(4, '0'),
        lat: round(jitter(area.lat, 0.003), 6),
        lng: round(jitter(area.lng, 0.003), 6),
        address: 'Near ' + area.name + ', Kigali',
        active: i < cfg.poiCount - 1,
      });
    }
    await prisma.poi.createMany({ data: poiData });
    totals.pois += poiData.length;
    console.log('   ' + poiData.length + ' POIs');

    // â”€â”€ Geofence Zones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const zoneTypes = ['SLOW', 'NO_GO', 'PARK'];
    const zoneNameMap = {
      SLOW:  ['Slow Zone', 'Speed Restricted', 'Reduced Speed', 'Caution Zone', 'Safety Zone'],
      NO_GO: ['Restricted Area', 'No-Go Zone', 'Prohibited', 'Exclusion Area', 'Off-Limits'],
      PARK:  ['Parking Zone', 'Depot Area', 'Staging Zone', 'Holding Area', 'Overnight Lot'],
    };
    const zoneData = [];
    for (let i = 0; i < cfg.zoneCount; i++) {
      const area = KIGALI_AREAS[i % KIGALI_AREAS.length];
      const zType = zoneTypes[i % zoneTypes.length];
      const zNames = zoneNameMap[zType];
      zoneData.push({
        fleetId: cfg.id,
        name: area.name + ' ' + zNames[i % zNames.length],
        type: zType,
        geojsonPolygon: buildSquarePolygon(jitter(area.lat, 0.002), jitter(area.lng, 0.002), 0.001 + Math.random() * 0.003),
        speedLimitKph: zType === 'SLOW' ? round(15 + Math.random() * 25, 0) : zType === 'NO_GO' ? 0 : null,
        active: i < cfg.zoneCount - 2,
      });
    }
    await prisma.geofenceZone.createMany({ data: zoneData });
    totals.zones += zoneData.length;
    console.log('   ' + zoneData.length + ' geofence zones');

    // â”€â”€ Emergency Contacts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const contactRoles = ['DISPATCH', 'MANAGER', 'EMERGENCY'];
    const contactNameList = ['Dispatch Desk', 'Operations Manager', 'Emergency Response', 'Fleet Supervisor', 'Night Shift Dispatch', 'Safety Officer'];
    const contactData = [];
    const contactPhoneBase = cfg.bikePrefix === 'Demo' ? 0 : cfg.bikePrefix === 'North' ? 50 : 100;
    for (let i = 0; i < cfg.contactCount; i++) {
      contactData.push({
        fleetId: cfg.id,
        name: cfg.name + ' ' + contactNameList[i % contactNameList.length],
        phone: '+25072' + String(3000 + i + contactPhoneBase).padStart(4, '0'),
        role: contactRoles[i % contactRoles.length],
        active: true,
      });
    }
    await prisma.emergencyContact.createMany({ data: contactData });
    totals.contacts += contactData.length;
    console.log('   ' + contactData.length + ' emergency contacts');

    // â”€â”€ Trips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tripData = [];
    for (let i = 0; i < cfg.tripCount; i++) {
      const daysAgo = Math.floor(i / 3);
      const minutesAgo = daysAgo * 24 * 60 + 60 + i * 37;
      const duration = 600 + Math.floor(Math.random() * 2400);
      const bikeKey = activeBikeKeys[i % activeBikeKeys.length];
      const riderKey = riderKeys[i % riderKeys.length];
      tripData.push({
        fleetId: cfg.id,
        bikeId: bikes[bikeKey].id,
        riderId: users[riderKey].id,
        startTs: offsetMinutes(now, -minutesAgo - duration / 60),
        endTs: offsetMinutes(now, -minutesAgo),
        distanceKm: round(2 + Math.random() * 20, 3),
        durationSec: duration,
        score: round(55 + Math.random() * 45, 2),
      });
    }
    await prisma.trip.createMany({ data: tripData });
    totals.trips += tripData.length;
    console.log('   ' + tripData.length + ' trips');

    // â”€â”€ Telemetry Points â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let allTelemetry = [];
    const telTripCount = Math.min(cfg.tripCount, 35);
    for (let i = 0; i < telTripCount; i++) {
      const trip = tripData[i];
      const startArea = pickArea();
      const endArea = pickArea();
      const devKey = activeDevKeys[i % activeDevKeys.length];
      allTelemetry = allTelemetry.concat(buildTripTelemetryPoints({
        deviceId: devices[devKey].id,
        startTs: trip.startTs, endTs: trip.endTs,
        startLat: startArea.lat, startLng: startArea.lng,
        endLat: endArea.lat, endLng: endArea.lng,
        speeds: generateSpeedProfile(6 + Math.floor(Math.random() * 4)),
        batteryStart: 48 + Math.random() * 6,
      }));
    }

    // â”€â”€ Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const eventData = [];
    for (let i = 0; i < cfg.eventCount; i++) {
      const daysAgo = Math.floor(i / 4);
      const minutesAgo = daysAgo * 24 * 60 + 30 + i * 23;
      const eType = EVENT_TYPES[i % EVENT_TYPES.length];
      const bikeKey = activeBikeKeys[i % activeBikeKeys.length];
      const devKey = activeDevKeys[i % activeDevKeys.length];
      const area = pickArea();

      let severity;
      if (eType === 'CRASH') severity = 'CRITICAL';
      else if (['SOS', 'THEFT_SUSPECTED', 'HARSH_ACCEL', 'HARSH_BRAKE'].indexOf(eType) >= 0) severity = 'HIGH';
      else if (['OVERSPEED', 'HARSH_CORNER', 'SPEED_LIMIT_VIOLATION'].indexOf(eType) >= 0) severity = 'MEDIUM';
      else severity = 'LOW';

      const metaJson = { source: 'seed', area: area.name };
      if (eType === 'OVERSPEED' || eType === 'SPEED_LIMIT_VIOLATION') {
        metaJson.speedKph = round(35 + Math.random() * 30, 1);
        metaJson.speedLimitKph = 30;
      } else if (eType.indexOf('ZONE_SPEED') >= 0) {
        metaJson.speedKph = round(20 + Math.random() * 15, 1);
        metaJson.speedLimitKph = 15;
        metaJson.zoneName = area.name + ' Zone';
      } else if (eType === 'HARSH_BRAKE') {
        metaJson.accelY = round(-3 - Math.random() * 3, 1);
      } else if (eType === 'HARSH_ACCEL') {
        metaJson.accelX = round(3 + Math.random() * 3, 1);
      } else if (eType === 'HARSH_CORNER') {
        metaJson.lateralG = round(0.8 + Math.random() * 1.2, 1);
      } else if (eType === 'CRASH') {
        metaJson.gForce = round(3 + Math.random() * 4, 1);
        metaJson.speedDropKph = round(15 + Math.random() * 30, 0);
        metaJson.tiltDeg = round(40 + Math.random() * 50, 0);
        const crashTs = offsetMinutes(now, -minutesAgo);
        allTelemetry = allTelemetry.concat(buildCrashTelemetryWindow(devices[devKey].id, crashTs, area.lat, area.lng));
      } else if (eType === 'THEFT_SUSPECTED') {
        metaJson.ignition = false;
        metaJson.rule = 'movement_while_off';
      } else if (eType === 'SOS') {
        metaJson.note = pick(['Roadside assistance needed', 'Flat tire', 'Mechanical issue', 'Road blocked', 'Medical assistance']);
      }

      eventData.push({
        fleetId: cfg.id,
        bikeId: bikes[bikeKey].id,
        deviceId: devices[devKey].id,
        ts: offsetMinutes(now, -minutesAgo),
        type: eType, severity: severity, metaJson: metaJson,
      });
    }

    // Write telemetry in chunks
    for (let c = 0; c < allTelemetry.length; c += 500) {
      await prisma.telemetryPoint.createMany({ data: allTelemetry.slice(c, c + 500) });
    }
    totals.telemetry += allTelemetry.length;
    console.log('   ' + allTelemetry.length + ' telemetry points');

    // Create events individually to get IDs for incidents
    const createdEvents = [];
    for (let ei = 0; ei < eventData.length; ei++) {
      const ev = await prisma.event.create({ data: eventData[ei] });
      createdEvents.push({ id: ev.id, bikeId: ev.bikeId, deviceId: ev.deviceId, ts: ev.ts, _type: eventData[ei].type });
    }
    totals.events += createdEvents.length;
    console.log('   ' + createdEvents.length + ' events (all 11 types)');

    // â”€â”€ Incidents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const incidentEvents = createdEvents.filter(function(e) { return INCIDENT_EVENT_TYPES.indexOf(e._type) >= 0; });
    const incidentStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'];
    const createdIncidents = [];
    for (let ii = 0; ii < incidentEvents.length; ii++) {
      const ev = incidentEvents[ii];
      const status = incidentStatuses[ii % incidentStatuses.length];
      const incident = {
        fleetId: cfg.id,
        bikeId: ev.bikeId,
        deviceId: ev.deviceId,
        eventId: ev.id,
        status: status,
        notes: status === 'OPEN' ? 'Awaiting investigation' :
               status === 'ACKNOWLEDGED' ? 'Team dispatched to location' :
               status === 'RESOLVED' ? 'Resolved after inspection' :
               'Verified as sensor malfunction',
      };
      if (['ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'].indexOf(status) >= 0) {
        const dKey = dispatchKeys.length > 0 ? dispatchKeys[ii % dispatchKeys.length] : adminKeys[0];
        incident.acknowledgedByUserId = users[dKey].id;
        incident.acknowledgedAt = offsetMinutes(ev.ts, 5 + Math.floor(Math.random() * 30));
      }
      if (['RESOLVED', 'FALSE_ALARM'].indexOf(status) >= 0) {
        incident.resolvedByUserId = users[adminKeys[ii % adminKeys.length]].id;
        incident.resolvedAt = offsetMinutes(ev.ts, 60 + Math.floor(Math.random() * 180));
      }
      // Use fixed IDs for Postman E2E tests (demo fleet only)
      if (cfg.id === DEMO_FLEET_ID) {
        if (status === 'RESOLVED' && !createdIncidents.some(function(c) { return c.id === DEMO_RESOLVED_INCIDENT_ID; })) {
          incident.id = DEMO_RESOLVED_INCIDENT_ID;
        } else if (status === 'OPEN' && !createdIncidents.some(function(c) { return c.id === DEMO_OPEN_INCIDENT_ID; })) {
          incident.id = DEMO_OPEN_INCIDENT_ID;
        }
      }
      const created = await prisma.incident.create({ data: incident });
      createdIncidents.push(created);
    }
    totals.incidents += createdIncidents.length;
    console.log('   ' + createdIncidents.length + ' incidents');

    // â”€â”€ Evidence Packs (for resolved incidents) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const resolved = createdIncidents.filter(function(inc) { return inc.status === 'RESOLVED'; });
    for (let ri = 0; ri < resolved.length; ri++) {
      await prisma.evidencePack.create({
        data: {
          incidentId: resolved[ri].id,
          s3KeyJson: 'evidence/' + cfg.id + '/' + resolved[ri].id + '/report.json',
          s3KeyCsv: 'evidence/' + cfg.id + '/' + resolved[ri].id + '/telemetry.csv',
        },
      });
    }
    totals.evidencePacks += resolved.length;
    console.log('   ' + resolved.length + ' evidence packs');

    // â”€â”€ Device Commands â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const cmdStatuses = ['PENDING', 'SENT', 'ACKED', 'FAILED', 'EXPIRED'];
    const cmdData = [];
    for (let i = 0; i < cfg.commandCount; i++) {
      const devKey = activeDevKeys[i % activeDevKeys.length];
      const bikeKey = activeBikeKeys[i % activeBikeKeys.length];
      const cmdType = i % 2 === 0 ? 'LOCK' : 'UNLOCK';
      const status = cmdStatuses[i % cmdStatuses.length];
      const requestedAt = offsetMinutes(now, -(30 + i * 47));
      cmdData.push({
        fleetId: cfg.id,
        deviceId: devices[devKey].id,
        bikeId: bikes[bikeKey].id,
        type: cmdType, status: status,
        requestedByUserId: users[adminKeys[i % adminKeys.length]].id,
        requestedAt: requestedAt,
        sentAt: ['SENT', 'ACKED'].indexOf(status) >= 0 ? offsetMinutes(requestedAt, 0.1) : null,
        ackedAt: status === 'ACKED' ? offsetMinutes(requestedAt, 0.5) : null,
        payloadJson: { action: cmdType.toLowerCase(), reason: cmdType === 'LOCK' ? 'Security hold' : 'Rider release' },
        errorMessage: status === 'FAILED' ? 'Device not responding' : null,
        nonce: randomUuidNonce(),
        expiresAt: offsetMinutes(requestedAt, 5),
      });
    }
    await prisma.deviceCommand.createMany({ data: cmdData });
    totals.commands += cmdData.length;
    console.log('   ' + cmdData.length + ' device commands');

    // â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const notifTypes = ['CRASH_ALERT', 'THEFT_ALERT', 'SOS_ALERT'];
    const notifChannels = ['SMS', 'EMAIL', 'WEBHOOK'];
    const notifData = [];
    for (let i = 0; i < cfg.notifCount; i++) {
      const nType = notifTypes[i % notifTypes.length];
      const channel = notifChannels[i % notifChannels.length];
      const nStatus = i % 4 === 0 ? 'PENDING' : i % 4 === 3 ? 'FAILED' : 'SENT';
      notifData.push({
        fleetId: cfg.id,
        type: nType, channel: channel,
        to: channel === 'SMS' ? '+25078' + String(5000 + i).padStart(4, '0') :
            channel === 'EMAIL' ? 'alert' + i + '@' + cfg.domain :
            'https://hooks.' + cfg.domain + '/alert/' + i,
        payloadJson: { source: 'seed', bikeLabel: bikeFixtures[i % bikeFixtures.length].label, severity: nType === 'CRASH_ALERT' ? 'CRITICAL' : 'HIGH' },
        status: nStatus,
        attemptCount: nStatus === 'PENDING' ? 0 : nStatus === 'FAILED' ? 3 : 1,
        errorMessage: nStatus === 'FAILED' ? 'Delivery timeout after 3 attempts' : null,
        sentAt: nStatus === 'SENT' ? offsetMinutes(now, -(10 + i * 30)) : null,
      });
    }
    await prisma.notification.createMany({ data: notifData });
    totals.notifications += notifData.length;
    console.log('   ' + notifData.length + ' notifications');

    // â”€â”€ Score Summaries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const weekStart = offsetMinutes(now, -7 * 24 * 60);
    const monthStart = offsetMinutes(now, -30 * 24 * 60);
    const scoreData = [];

    // Rider weekly scores
    for (let ri = 0; ri < riderKeys.length; ri++) {
      scoreData.push({
        fleetId: cfg.id, scope: 'RIDER', refId: users[riderKeys[ri]].id,
        periodStart: weekStart, periodEnd: now,
        score: round(60 + Math.random() * 40, 2),
        breakdownJson: {
          tripCount: 2 + Math.floor(Math.random() * 6),
          avgDistanceKm: round(5 + Math.random() * 15, 1),
          eventCounts: { OVERSPEED: Math.floor(Math.random() * 3), HARSH_BRAKE: Math.floor(Math.random() * 2), CRASH: 0 },
        },
      });
    }
    // Rider monthly scores
    for (let ri = 0; ri < riderKeys.length; ri++) {
      scoreData.push({
        fleetId: cfg.id, scope: 'RIDER', refId: users[riderKeys[ri]].id,
        periodStart: monthStart, periodEnd: now,
        score: round(55 + Math.random() * 45, 2),
        breakdownJson: {
          tripCount: 8 + Math.floor(Math.random() * 20),
          avgDistanceKm: round(6 + Math.random() * 14, 1),
          eventCounts: { OVERSPEED: Math.floor(Math.random() * 8), HARSH_BRAKE: Math.floor(Math.random() * 5), CRASH: Math.floor(Math.random() * 2) },
        },
      });
    }
    // Bike weekly scores
    const bikeScoreCount = Math.min(activeBikeKeys.length, 15);
    for (let bi = 0; bi < bikeScoreCount; bi++) {
      scoreData.push({
        fleetId: cfg.id, scope: 'BIKE', refId: bikes[activeBikeKeys[bi]].id,
        periodStart: weekStart, periodEnd: now,
        score: round(60 + Math.random() * 40, 2),
        breakdownJson: { tripCount: 1 + Math.floor(Math.random() * 5) },
      });
    }
    // Fleet weekly + monthly
    scoreData.push({
      fleetId: cfg.id, scope: 'FLEET', refId: null,
      periodStart: weekStart, periodEnd: now,
      score: round(70 + Math.random() * 25, 2),
      breakdownJson: { tripCount: cfg.tripCount, incidentCount: createdIncidents.length, activeBikeCount: activeBikeKeys.length },
    });
    scoreData.push({
      fleetId: cfg.id, scope: 'FLEET', refId: null,
      periodStart: monthStart, periodEnd: now,
      score: round(65 + Math.random() * 30, 2),
      breakdownJson: { tripCount: cfg.tripCount * 3, incidentCount: createdIncidents.length * 2, activeBikeCount: activeBikeKeys.length },
    });
    await prisma.scoreSummary.createMany({ data: scoreData });
    totals.scores += scoreData.length;
    console.log('   ' + scoreData.length + ' score summaries');

    // â”€â”€ Audit Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const auditActions = [
      'ZONE_CREATED', 'ZONE_UPDATED', 'ZONE_DELETED',
      'LOCK_ACTION_REQUESTED', 'DEVICE_COMMAND_REQUESTED', 'DEVICE_COMMAND_STATUS_CHANGED',
      'RIDER_CREATED', 'BIKE_ASSIGNMENT_CHANGED',
      'SOS_TRIGGERED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'DEVICE_SECRET_ROTATED',
    ];
    const auditData = [];
    const allActorKeys = adminKeys.concat(dispatchKeys);
    for (let i = 0; i < cfg.auditCount; i++) {
      const action = auditActions[i % auditActions.length];
      const actorKey = allActorKeys[i % allActorKeys.length];
      auditData.push({
        fleetId: cfg.id,
        actorUserId: users[actorKey].id,
        actionType: action,
        targetType: action.indexOf('ZONE') === 0 ? 'GeofenceZone' :
                    action.indexOf('DEVICE') >= 0 || action.indexOf('LOCK') >= 0 ? 'Device' :
                    action.indexOf('RIDER') >= 0 || action.indexOf('LOGIN') >= 0 ? 'User' :
                    action.indexOf('BIKE') >= 0 ? 'BikeAssignment' :
                    action.indexOf('SOS') >= 0 ? 'Event' : 'System',
        targetId: bikes[activeBikeKeys[i % activeBikeKeys.length]].id,
        metaJson: { source: 'seed', action: action, ts: offsetMinutes(now, -(i * 45 + 10)).toISOString() },
      });
    }
    await prisma.auditLog.createMany({ data: auditData });
    totals.auditLogs += auditData.length;
    console.log('   ' + auditData.length + ' audit logs');

    // â”€â”€ Registration Invites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const invStatuses = ['ACTIVE', 'USED', 'EXPIRED', 'REVOKED'];
    const invData = [];
    for (let i = 0; i < cfg.inviteCount; i++) {
      const invStatus = invStatuses[i % invStatuses.length];
      invData.push({
        fleetId: cfg.id,
        role: 'RIDER',
        email: 'invite.' + (i + 1) + '@' + cfg.domain,
        tokenHash: hashSecret(randomBytes(32).toString('hex')),
        status: invStatus,
        expiresAt: invStatus === 'EXPIRED' ? offsetMinutes(now, -24 * 60) : offsetMinutes(now, 48 * 60),
        usedAt: invStatus === 'USED' ? offsetMinutes(now, -(5 + i) * 24 * 60) : null,
        usedByUserId: invStatus === 'USED' ? users[riderKeys[i % riderKeys.length]].id : null,
      });
    }
    await prisma.registrationInvite.createMany({ data: invData });
    totals.invites += invData.length;
    console.log('   ' + invData.length + ' registration invites');

    // â”€â”€ Live Bike States (Redis) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const liveStates = [];
    const liveCount = Math.min(activeBikeKeys.length, 18);
    for (let i = 0; i < liveCount; i++) {
      const bikeKey = activeBikeKeys[i];
      const devKey = activeDevKeys[i];
      if (!devices[devKey]) continue;
      const area = KIGALI_AREAS[i % KIGALI_AREAS.length];
      const isMoving = i % 3 !== 0;
      liveStates.push({
        fleetId: cfg.id,
        bikeId: bikes[bikeKey].id,
        deviceId: devices[devKey].id,
        deviceUid: devices[devKey].deviceUid,
        ts: new Date(now.getTime() - (5 + i * 3) * 1000).toISOString(),
        lat: round(jitter(area.lat, 0.005), 6),
        lng: round(jitter(area.lng, 0.005), 6),
        speedKph: isMoving ? round(8 + Math.random() * 35, 1) : 0,
        heading: round(Math.random() * 360, 0),
        batteryV: round(46 + Math.random() * 8, 3),
        ignition: isMoving,
      });
    }
    await seedLiveBikeStates(cfg.id, liveStates);
    console.log('   ' + liveStates.length + ' live bike states (Redis)');

    // Update device lastSeenAt
    for (let ls = 0; ls < liveStates.length; ls++) {
      await prisma.device.update({ where: { id: liveStates[ls].deviceId }, data: { lastSeenAt: new Date(liveStates[ls].ts) } });
    }
    for (let i = liveCount; i < activeDevKeys.length; i++) {
      await prisma.device.update({
        where: { id: devices[activeDevKeys[i]].id },
        data: { lastSeenAt: offsetMinutes(now, -(60 + i * 120)) },
      });
    }

    totals.users   += userFixtures.length;
    totals.bikes   += bikeFixtures.length;
    totals.devices += deviceFixtures.length;

  }

  // --- E-Moto HQ Fleet & Admin User ---
  console.log('\n-- E-Moto HQ --');
  const hqFleetId = '00000000-0000-0000-0000-000000000000';
  await prisma.fleet.upsert({
    where: { id: hqFleetId },
    update: { name: 'E-Moto HQ', type: 'DELIVERY', plan: 'PREMIUM', subscriptionStatus: 'ACTIVE' },
    create: { id: hqFleetId, name: 'E-Moto HQ', type: 'DELIVERY', plan: 'PREMIUM', subscriptionStatus: 'ACTIVE' },
  });

  const hqAdminEmail = 'admin@hq.emoto';
  const hqAdminPhone = '+250788000000';
  await prisma.user.upsert({
    where: { fleetId_email: { fleetId: hqFleetId, email: hqAdminEmail } },
    update: { role: 'ADMIN', phone: hqAdminPhone, passwordHash: demoHash, status: 'ACTIVE' },
    create: { fleetId: hqFleetId, role: 'ADMIN', email: hqAdminEmail, phone: hqAdminPhone, passwordHash: demoHash, status: 'ACTIVE' },
  });
  console.log('   E-Moto HQ fleet and admin@hq.emoto user seeded.');


  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PARTNERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  console.log('\n-- Partners --');

  const seedPartnerClientId     = process.env.SEED_PARTNER_CLIENT_ID || 'partner-demo-client';
  const seedPartnerClientSecret = process.env.SEED_PARTNER_CLIENT_SECRET || 'PartnerSecret123!';
  const seedPartnerScopes       = process.env.SEED_PARTNER_SCOPES || 'insurer:read webhooks:write';
  const partnerClientSecretHash = await hashPassword(seedPartnerClientSecret);

  // Partner 1: Demo Insurer
  const partner1 = await prisma.partner.upsert({
    where: { id: DEMO_PARTNER_ID },
    update: { name: 'Demo Insurer Partner', status: 'ACTIVE' },
    create: { id: DEMO_PARTNER_ID, name: 'Demo Insurer Partner', status: 'ACTIVE' },
  });

  await prisma.partnerClient.upsert({
    where: { clientId: seedPartnerClientId },
    update: { partnerId: partner1.id, clientSecretHash: partnerClientSecretHash, scopes: seedPartnerScopes, status: 'ACTIVE' },
    create: { partnerId: partner1.id, clientId: seedPartnerClientId, clientSecretHash: partnerClientSecretHash, scopes: seedPartnerScopes, status: 'ACTIVE' },
  });

  const webhookSecret1 = 'partner-webhook-' + seedPartnerClientId;
  await prisma.partnerWebhook.upsert({
    where: { id: DEMO_PARTNER_WEBHOOK_ID },
    update: { partnerId: partner1.id, url: 'https://insurer-api.example.com/emoto/webhook', secretHash: hashSecret(webhookSecret1), secretEncrypted: encryptSecret(webhookSecret1, partnerWebhookSecretMasterKey), active: true },
    create: { id: DEMO_PARTNER_WEBHOOK_ID, partnerId: partner1.id, url: 'https://insurer-api.example.com/emoto/webhook', secretHash: hashSecret(webhookSecret1), secretEncrypted: encryptSecret(webhookSecret1, partnerWebhookSecretMasterKey), active: true },
  });

  const partnerFleetIds = [DEMO_FLEET_ID, SECOND_FLEET_ID];
  for (let pi = 0; pi < partnerFleetIds.length; pi++) {
    await prisma.partnerFleetAccess.upsert({
      where: { partnerId_fleetId: { partnerId: partner1.id, fleetId: partnerFleetIds[pi] } },
      update: { active: true },
      create: { partnerId: partner1.id, fleetId: partnerFleetIds[pi], active: true },
    });
  }

  // Partner 2: Mobility Analytics
  const partner2 = await prisma.partner.upsert({
    where: { id: SECOND_PARTNER_ID },
    update: { name: 'Mobility Analytics Corp', status: 'ACTIVE' },
    create: { id: SECOND_PARTNER_ID, name: 'Mobility Analytics Corp', status: 'ACTIVE' },
  });

  const analyticsClientHash = await hashPassword('AnalyticsSecret456!');
  await prisma.partnerClient.upsert({
    where: { clientId: 'partner-analytics-client' },
    update: { partnerId: partner2.id, clientSecretHash: analyticsClientHash, scopes: 'insurer:read', status: 'ACTIVE' },
    create: { partnerId: partner2.id, clientId: 'partner-analytics-client', clientSecretHash: analyticsClientHash, scopes: 'insurer:read', status: 'ACTIVE' },
  });

  await prisma.partnerFleetAccess.upsert({
    where: { partnerId_fleetId: { partnerId: partner2.id, fleetId: THIRD_FLEET_ID } },
    update: { active: true },
    create: { partnerId: partner2.id, fleetId: THIRD_FLEET_ID, active: true },
  });

  console.log('   2 partners, 2 clients, 3 fleet accesses, 1 webhook');

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ROAD FEATURES (global)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  console.log('\n-- Road Features --');
  await prisma.roadFeature.deleteMany({});

  const rfTypes = ['SCHOOL', 'HOSPITAL', 'MARKET', 'TRAFFIC_SIGN', 'SPEED_LIMIT'];
  const rfNameMap = {
    SCHOOL:       ['Primary School', 'Secondary School', 'Lycee', 'College', 'Academy', 'International School', 'Technical Institute', 'Nursery School', 'University Campus', 'Training Center'],
    HOSPITAL:     ['District Hospital', 'Health Center', 'Polyclinic', 'Clinic', 'Medical Center', 'Pharmacy', 'Maternity Hospital', 'Eye Clinic', 'Dental Clinic', 'Referral Hospital'],
    MARKET:       ['Central Market', 'Market Square', 'Trading Post', 'Night Market', 'Farmers Market', 'Wholesale Market', 'Craft Market', 'Mini Market', 'Supermarket Area', 'Bus Station Market'],
    TRAFFIC_SIGN: ['Roundabout', 'Junction', 'Stop Sign', 'Yield Sign', 'Traffic Light', 'Pedestrian Crossing', 'Speed Bump', 'One Way', 'No Entry', 'Merge Point'],
    SPEED_LIMIT:  ['30 Zone Start', '40 Zone Start', '50 Zone Start', '25 Zone Start', '20 Zone Start', '60 Zone', '35 Zone Start', '45 Zone Start', '15 Zone Start', 'Variable Speed'],
  };
  const rfSpeedLimits = { SCHOOL: 15, HOSPITAL: 20, MARKET: 25, TRAFFIC_SIGN: null, SPEED_LIMIT: null };
  const osmTypes = ['NODE', 'WAY', 'RELATION'];
  const rfData = [];
  for (let i = 0; i < 55; i++) {
    const rfType = rfTypes[i % rfTypes.length];
    const area = KIGALI_AREAS[i % KIGALI_AREAS.length];
    const names = rfNameMap[rfType];
    rfData.push({
      source: 'OSM',
      osmId: String(100000 + i),
      osmType: osmTypes[i % osmTypes.length],
      type: rfType,
      name: area.name + ' ' + names[i % names.length],
      speedLimitKph: rfType === 'SPEED_LIMIT' ? (15 + (i % 4) * 10) : rfSpeedLimits[rfType],
      lat: round(jitter(area.lat, 0.004), 6),
      lng: round(jitter(area.lng, 0.004), 6),
      tagsJson: { source: 'seed', area: area.name, osm_type: rfType.toLowerCase() },
    });
  }
  await prisma.roadFeature.createMany({ data: rfData });
  console.log('   ' + rfData.length + ' road features');

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SUMMARY
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  console.log('\n========================================');
  console.log('  SEED COMPLETE');
  console.log('========================================');
  console.log(JSON.stringify({
    fleets: fleetConfigs.length,
    users: totals.users,
    bikes: totals.bikes,
    devices: totals.devices,
    trips: totals.trips,
    events: totals.events,
    incidents: totals.incidents,
    zones: totals.zones,
    pois: totals.pois,
    scores: totals.scores,
    notifications: totals.notifications,
    commands: totals.commands,
    assignments: totals.assignments,
    auditLogs: totals.auditLogs,
    telemetry: totals.telemetry,
    contacts: totals.contacts,
    invites: totals.invites,
    evidencePacks: totals.evidencePacks,
    roadFeatures: rfData.length,
    partners: 2,
    seedVersion: 'comprehensive-v2',
  }, null, 2));
  console.log('\nLogin credentials:');
  console.log('  E-Moto HQ Staff:   admin@hq.emoto / ChangeMe123!');
  console.log('  Demo Fleet:        admin.01@demo.emoto / ChangeMe123!');
  console.log('  North Ops Fleet:   admin.01@north.demo.emoto / FleetTwo123!');
  console.log('  South Metro Fleet: admin@south.demo.emoto / FleetThree123!');
}

seed()
  .catch(function(error) {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(function() {
    return prisma.$disconnect();
  });
