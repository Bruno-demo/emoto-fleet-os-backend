const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash('password123', 10);

  const fleetId = '00000000-0000-0000-0000-000000000004';
  const userId = '00000000-0000-0000-0000-000000000401';
  const bikeId = '00000000-0000-0000-0000-000000000411';

  console.log('Creating demo rider owner...');

  try {
    // 1. Create PERSONAL Fleet
    await prisma.fleet.upsert({
      where: { id: fleetId },
      update: {},
      create: {
        id: fleetId,
        name: 'Individual Owner Fleet',
        type: 'PERSONAL',
        plan: 'DEMO',
        subscriptionStatus: 'ACTIVE',
      },
    });

    // 2. Create User (Rider Role)
    await prisma.user.upsert({
      where: { id: userId },
      update: {
        passwordHash,
      },
      create: {
        id: userId,
        fleetId: fleetId,
        role: 'RIDER',
        email: 'rider-owner@emoto.com',
        phone: '+254700000000',
        passwordHash: passwordHash,
        status: 'ACTIVE',
      },
    });

    // 3. Create Rider Profile
    await prisma.riderProfile.upsert({
      where: { userId: userId },
      update: {},
      create: {
        userId: userId,
        fullName: 'Demo Rider Owner',
      },
    });

    // 4. Create Bike
    await prisma.bike.upsert({
      where: { id: bikeId },
      update: {},
      create: {
        id: bikeId,
        fleetId: fleetId,
        label: 'My Personal Bike',
        plate: 'RA 123 B',
        serial: 'SN-PERSONAL-001',
        model: 'eMoto X-Owner',
        status: 'ACTIVE',
      },
    });

    // 5. Create Bike Assignment (Delete existing first to ensure clean state)
    await prisma.bikeAssignment.deleteMany({
      where: { bikeId: bikeId },
    });

    await prisma.bikeAssignment.create({
      data: {
        fleetId: fleetId,
        bikeId: bikeId,
        riderUserId: userId,
        active: true,
      },
    });

    console.log('Demo rider owner created successfully!');
    console.log('Login: +254700000000 / password123');
  } catch (error) {
    console.error('Error creating demo rider owner:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
