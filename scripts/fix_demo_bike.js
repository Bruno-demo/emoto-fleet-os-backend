const { PrismaClient } = require('@prisma/client');
const { createCipheriv, createHash, randomBytes } = require('crypto');
const Redis = require('ioredis');

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_SECRET_VERSION = 'v1';

function deriveMasterKey(masterKey) {
  return createHash('sha256').update(masterKey).digest();
}

function hashDeviceSecret(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

function encryptDeviceSecret(deviceSecret, masterKey) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, deriveMasterKey(masterKey), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(deviceSecret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_SECRET_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

async function main() {
  const prisma = new PrismaClient();
  const redis = new Redis('redis://localhost:6379');
  
  const bikeId = '00000000-0000-0000-0000-000000000411';
  const fleetId = '00000000-0000-0000-0000-000000000404'; // Wait, let me check the fleetId I used in create_rider_owner.js
  // Re-reading create_rider_owner.js... it was 00000000-0000-0000-0000-000000000004
  const actualFleetId = '00000000-0000-0000-0000-000000000004';
  const deviceId = '00000000-0000-0000-0000-000000000421';
  const masterKey = 'your-32-char-master-key-here-1234';
  const secret = 'demo-device-secret-123';
  
  console.log('Fixing demo bike: adding device and faking live state...');

  try {
    // 1. Create Device
    await prisma.device.upsert({
      where: { id: deviceId },
      update: {
        status: 'ACTIVE',
        bikeId: bikeId,
      },
      create: {
        id: deviceId,
        fleetId: actualFleetId,
        bikeId: bikeId,
        deviceUid: 'DEMO-DEVICE-001',
        status: 'ACTIVE',
        secretHash: hashDeviceSecret(secret),
        secretEncrypted: encryptDeviceSecret(secret, masterKey),
      },
    });

    // 2. Fake Live State in Redis
    const stateKey = `live:fleet:${actualFleetId}:bike:${bikeId}`;
    const state = {
      ts: new Date(Date.now() - 20000).toISOString(), // 20 seconds ago, speed 0
      speedKph: 0,
      lat: -1.9441,
      lng: 30.0619,
      heading: 0,
      odometerKm: 123.4,
      soc: 85,
      isCharging: false,
      isLocked: false,
    };
    await redis.set(stateKey, JSON.stringify(state), 'EX', 60); // Expire in 60s

    console.log(`Successfully fixed demo bike!`);
    console.log(`Device ID: ${deviceId}`);
    console.log(`Redis key set: ${stateKey}`);
  } catch (error) {
    console.error('Error fixing demo bike:', error);
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

main();
