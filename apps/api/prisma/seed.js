const { createCipheriv, createHash, randomBytes } = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DEVICE_SECRET_FORMAT_VERSION = 'v1';

// Derives an AES key from master secret for deterministic encryption behavior.
function deriveMasterKey(masterKey) {
  return createHash('sha256').update(masterKey).digest();
}

// Produces a deterministic hash for demo secrets used during local seeding.
function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex');
}

// Encrypts seed device secret so MQTT verifier can validate HMAC messages.
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

// Hashes user passwords with bcrypt for login compatibility.
async function hashPassword(password) {
  const rounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10);
  return bcrypt.hash(password, rounds);
}

// Seeds one demo fleet, admin, bike, and linked device for local development.
async function seed() {
  const adminEmail = 'admin@demo.emoto';
  const adminPhone = '+250700000001';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const seedDeviceUid = process.env.SEED_DEVICE_UID ?? 'DEV-0001';
  const seedDeviceSecret = process.env.SEED_DEVICE_SECRET ?? 'device-secret-0001';
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
  const adminPasswordHash = await hashPassword(adminPassword);
  const partnerClientSecretHash = await hashPassword(seedPartnerClientSecret);

  const fleet = await prisma.fleet.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Fleet',
      type: 'DELIVERY',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: {
      fleetId_email: {
        fleetId: fleet.id,
        email: adminEmail,
      },
    },
    update: {
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      phone: adminPhone,
      status: 'ACTIVE',
    },
    create: {
      fleetId: fleet.id,
      role: 'ADMIN',
      email: adminEmail,
      phone: adminPhone,
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
    },
  });

  const bike = await prisma.bike.upsert({
    where: {
      fleetId_label: {
        fleetId: fleet.id,
        label: 'Bike-001',
      },
    },
    update: {
      model: 'eMoto-X',
      status: 'ACTIVE',
    },
    create: {
      fleetId: fleet.id,
      label: 'Bike-001',
      model: 'eMoto-X',
      status: 'ACTIVE',
    },
  });

  const device = await prisma.device.upsert({
    where: {
      deviceUid: seedDeviceUid,
    },
    update: {
      fleetId: fleet.id,
      bikeId: bike.id,
      status: 'ACTIVE',
      secretHash: hashSecret(seedDeviceSecret),
      secretEncrypted: encryptSecret(seedDeviceSecret, deviceSecretMasterKey),
    },
    create: {
      fleetId: fleet.id,
      deviceUid: seedDeviceUid,
      bikeId: bike.id,
      secretHash: hashSecret(seedDeviceSecret),
      secretEncrypted: encryptSecret(seedDeviceSecret, deviceSecretMasterKey),
      status: 'ACTIVE',
    },
  });

  const partner = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {
      name: 'Demo Insurer Partner',
      status: 'ACTIVE',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      name: 'Demo Insurer Partner',
      status: 'ACTIVE',
    },
  });

  const partnerClient = await prisma.partnerClient.upsert({
    where: {
      clientId: seedPartnerClientId,
    },
    update: {
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
  const partnerWebhook = await prisma.partnerWebhook.upsert({
    where: {
      id: '00000000-0000-0000-0000-000000000221',
    },
    update: {
      url: 'https://example-insurer.invalid/emoto/webhook',
      secretHash: hashSecret(partnerWebhookSecret),
      secretEncrypted: encryptSecret(
        partnerWebhookSecret,
        partnerWebhookSecretMasterKey,
      ),
      active: false,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000221',
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

  console.log(
    JSON.stringify(
      {
        fleetId: fleet.id,
        adminUserId: adminUser.id,
        bikeId: bike.id,
        deviceId: device.id,
        partnerId: partner.id,
        partnerClientId: partnerClient.clientId,
        partnerClientSecret: seedPartnerClientSecret,
        partnerWebhookId: partnerWebhook.id,
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
