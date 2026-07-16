import { PrismaClient, PaymentMethod, PaymentStatus, BikeStatus, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const FLEET_ID = 'b6a71622-da10-4e6f-8dc1-b5cae142ae83';

async function main() {
  console.log('Starting custom fleet data seed...');

  // 1. Verify fleet exists
  const fleet = await prisma.fleet.findUnique({
    where: { id: FLEET_ID },
  });

  if (!fleet) {
    throw new Error(`Fleet with ID ${FLEET_ID} not found in the database.`);
  }
  console.log(`Target Fleet: ${fleet.name} (${fleet.type})`);

  // 2. Clean up previous seed data to keep it idempotent
  console.log('Cleaning up existing seed data for this fleet...');

  // Find users that match our seeding email pattern
  const existingRiders = await prisma.user.findMany({
    where: {
      fleetId: FLEET_ID,
      role: UserRole.RIDER,
      email: { startsWith: 'rider.' },
    },
  });
  const riderIds = existingRiders.map((r) => r.id);

  const existingBikes = await prisma.bike.findMany({
    where: {
      fleetId: FLEET_ID,
      label: { startsWith: 'KGL-B-' },
    },
  });
  const bikeIds = existingBikes.map((b) => b.id);

  console.log(`Found ${riderIds.length} existing riders and ${bikeIds.length} existing bikes to clean up.`);

  if (riderIds.length > 0) {
    await prisma.riderPayment.deleteMany({
      where: { riderId: { in: riderIds } },
    });
    await prisma.bikeAssignment.deleteMany({
      where: { riderUserId: { in: riderIds } },
    });
    await prisma.trip.deleteMany({
      where: { riderId: { in: riderIds } },
    });
    await prisma.riderProfile.deleteMany({
      where: { userId: { in: riderIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: riderIds } },
    });
  }

  if (bikeIds.length > 0) {
    await prisma.bikeAssignment.deleteMany({
      where: { bikeId: { in: bikeIds } },
    });
    await prisma.trip.deleteMany({
      where: { bikeId: { in: bikeIds } },
    });
    await prisma.event.deleteMany({
      where: { bikeId: { in: bikeIds } },
    });
    await prisma.bike.deleteMany({
      where: { id: { in: bikeIds } },
    });
  }

  console.log('Cleanup completed successfully.');

  // 3. Create 100 Bikes
  console.log('Creating 100 new bikes...');
  const bikesData = [];
  for (let i = 1; i <= 100; i++) {
    const padded = String(i).padStart(3, '0');
    bikesData.push({
      fleetId: FLEET_ID,
      label: `KGL-B-${padded}`,
      plate: `RA ${1000 + i} A`,
      serial: `SR-KGL-${padded}`,
      model: 'E-moto Max 2026',
      status: BikeStatus.ACTIVE,
      leaseToOwn: i <= 50, // Match leaseToOwn for first 50
    });
  }

  // Create bikes one by one to avoid transaction limits, or use createMany if supported
  const createdBikes = [];
  for (const bike of bikesData) {
    const b = await prisma.bike.create({ data: bike });
    createdBikes.push(b);
  }
  console.log(`Successfully created ${createdBikes.length} bikes.`);

  // 4. Create 100 Riders (Users + RiderProfiles)
  console.log('Creating 100 new riders with profiles...');
  const passwordHash = bcrypt.hashSync('Rider123!', 10);
  const createdRiders = [];

  for (let i = 1; i <= 100; i++) {
    const padded = String(i).padStart(3, '0');
    const isLeaseToOwn = i <= 50;

    const user = await prisma.user.create({
      data: {
        fleetId: FLEET_ID,
        role: UserRole.RIDER,
        email: `rider.${padded}@kigalicoop.com`,
        phone: `0780000${padded}`,
        passwordHash,
        status: UserStatus.ACTIVE,
        riderProfile: {
          create: {
            fullName: `Rider ${padded} (Coop)`,
            licenceNumber: `DL-KGL-${padded}`,
            identityNumber: `NID-KGL-${padded}`,
            leaseToOwn: isLeaseToOwn,
            leasePrincipal: isLeaseToOwn ? 2500000 : 0,
            leaseDailyRate: 15000,
          },
        },
      },
    });
    createdRiders.push(user);
  }
  console.log(`Successfully created ${createdRiders.length} riders with profiles.`);

  // 5. Create 80 BikeAssignments (leaving 20 riders and 20 bikes unassigned)
  console.log('Creating 80 active bike assignments (first 80 riders)...');
  const createdAssignments = [];
  const assignedAt = new Date();
  assignedAt.setDate(assignedAt.getDate() - 30); // Assigned 30 days ago

  for (let i = 0; i < 80; i++) {
    const assignment = await prisma.bikeAssignment.create({
      data: {
        fleetId: FLEET_ID,
        bikeId: createdBikes[i].id,
        riderUserId: createdRiders[i].id,
        assignedAt,
        active: true,
      },
    });
    createdAssignments.push(assignment);
  }
  console.log(`Successfully created ${createdAssignments.length} bike assignments.`);

  // 6. Populate Financial Data (RiderPayments) for the 80 assigned riders over the last 30 days
  console.log('Populating 30-day payment history for 80 assigned riders...');
  const paymentMethods: PaymentMethod[] = [PaymentMethod.MOBILE_MONEY, PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER];
  let paymentsCreated = 0;

  for (let r = 0; r < 80; r++) {
    const rider = createdRiders[r];
    const isLeaseToOwn = r < 50; // First 50 are lease-to-own

    // Generate payments day-by-day
    for (let day = 30; day >= 1; day--) {
      const paidAt = new Date();
      paidAt.setDate(paidAt.getDate() - day);
      paidAt.setHours(10 + (r % 8), (r * day) % 60, 0, 0); // Stagger payment times

      const rand = Math.random();
      let status: PaymentStatus = PaymentStatus.PAID;
      let amount = 15000;

      if (rand < 0.75) {
        status = PaymentStatus.PAID;
        amount = 15000;
      } else if (rand < 0.88) {
        status = PaymentStatus.PARTIAL;
        amount = Math.random() < 0.5 ? 10000 : 5000;
      } else if (rand < 0.95) {
        status = PaymentStatus.UNPAID;
        amount = 0;
      } else {
        status = PaymentStatus.OVERDUE;
        amount = 0;
      }

      // Record the payment (unless it was completely UNPAID, in which case we still log a payment entry with 0 to simulate outstanding arrears, or let the ledger track it)
      const txnRef = `TXN-${String(r).padStart(3, '0')}-${String(day).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const method = paymentMethods[(r + day) % paymentMethods.length];

      await prisma.riderPayment.create({
        data: {
          fleetId: FLEET_ID,
          riderId: rider.id,
          amount: amount,
          paidAt,
          method,
          status,
          reference: amount > 0 ? txnRef : null,
          notes: amount > 0 ? `Daily lease contribution` : `Payment missed/overdue`,
        },
      });
      paymentsCreated++;
    }
  }
  console.log(`Successfully created ${paymentsCreated} payment log entries.`);

  // 7. Populate Trip data over the last 7 days to make safety & operational reports look premium
  console.log('Populating safety trip logs...');
  let tripsCreated = 0;
  for (let r = 0; r < 80; r++) {
    const bike = createdBikes[r];
    const rider = createdRiders[r];

    // Create 3 trips per assigned bike/rider combo
    for (let t = 1; t <= 3; t++) {
      const startTs = new Date();
      startTs.setDate(startTs.getDate() - t);
      startTs.setHours(8 + t * 3, 0, 0, 0);

      const durationSec = 1200 + Math.floor(Math.random() * 1800); // 20-50 mins
      const distanceKm = 10 + Math.random() * 25; // 10-35 km
      const score = 70 + Math.random() * 28; // Score 70-98

      const endTs = new Date(startTs.getTime() + durationSec * 1000);

      await prisma.trip.create({
        data: {
          fleetId: FLEET_ID,
          bikeId: bike.id,
          riderId: rider.id,
          startTs,
          endTs,
          distanceKm,
          durationSec,
          score,
          startBatteryPct: 100.00,
          endBatteryPct: 100.00 - (distanceKm * 2.2), // Simple battery estimate
        },
      });
      tripsCreated++;
    }
  }
  console.log(`Successfully created ${tripsCreated} trips.`);

  console.log('Fleet account seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
