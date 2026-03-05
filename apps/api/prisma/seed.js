const { createHash } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Produces a deterministic hash for demo secrets used during local seeding.
function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex');
}

// Seeds one demo fleet, admin, bike, and linked device for local development.
async function seed() {
  const adminEmail = 'admin@demo.emoto';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

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
      passwordHash: hashSecret(adminPassword),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      fleetId: fleet.id,
      role: 'ADMIN',
      email: adminEmail,
      passwordHash: hashSecret(adminPassword),
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
      bikeId: bike.id,
      status: 'ACTIVE',
      secretHash: hashSecret('device-secret-0001'),
    },
    create: {
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
