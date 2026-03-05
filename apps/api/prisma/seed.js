const { createHash } = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Produces a deterministic hash for demo secrets used during local seeding.
function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex');
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
  const adminPasswordHash = await hashPassword(adminPassword);

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
      deviceUid: 'DEV-0001',
    },
    update: {
      fleetId: fleet.id,
      bikeId: bike.id,
      status: 'ACTIVE',
      secretHash: hashSecret('device-secret-0001'),
    },
    create: {
      fleetId: fleet.id,
      deviceUid: 'DEV-0001',
      bikeId: bike.id,
      secretHash: hashSecret('device-secret-0001'),
      status: 'ACTIVE',
    },
  });

  console.log(
    JSON.stringify(
      {
        fleetId: fleet.id,
        adminUserId: adminUser.id,
        bikeId: bike.id,
        deviceId: device.id,
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
