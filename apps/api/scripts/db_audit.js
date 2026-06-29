const path = require('path');
const fs = require('fs');

// Try to load .env from different directories
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    break;
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- DATABASE AUDIT ---');
  
  const tripCount = await prisma.trip.count();
  const eventCount = await prisma.event.count();
  const bikeCount = await prisma.bike.count();
  const riderCount = await prisma.user.count({ where: { role: 'RIDER' } });
  const paymentCount = await prisma.riderPayment.count();

  console.log(`Total Trips in DB: ${tripCount}`);
  console.log(`Total Events in DB: ${eventCount}`);
  console.log(`Total Bikes in DB: ${bikeCount}`);
  console.log(`Total Riders in DB: ${riderCount}`);
  console.log(`Total Rider Payments in DB: ${paymentCount}`);
  
  // Print latest 5 trips with dates and scores
  const latestTrips = await prisma.trip.findMany({
    orderBy: { startTs: 'desc' },
    take: 5,
    include: { bike: true }
  });
  console.log('\nLatest Trips:');
  latestTrips.forEach(t => {
    console.log(`- Trip ID: ${t.id}, startTs: ${t.startTs.toISOString()}, score: ${t.score}, bike: ${t.bike?.label}, fleetId: ${t.fleetId}`);
  });

  // Print latest 5 events
  const latestEvents = await prisma.event.findMany({
    orderBy: { ts: 'desc' },
    take: 5,
    include: { bike: true }
  });
  console.log('\nLatest Events:');
  latestEvents.forEach(e => {
    console.log(`- Event ID: ${e.id}, ts: ${e.ts.toISOString()}, type: ${e.type}, bike: ${e.bike?.label}, fleetId: ${e.fleetId}`);
  });

  // Print latest 5 payments
  const latestPayments = await prisma.riderPayment.findMany({
    orderBy: { paidAt: 'desc' },
    take: 5,
    include: { rider: true }
  });
  console.log('\nLatest Rider Payments:');
  latestPayments.forEach(p => {
    console.log(`- Payment ID: ${p.id}, paidAt: ${p.paidAt.toISOString()}, amount: ${p.amount}, status: ${p.status}, rider: ${p.rider?.email}, fleetId: ${p.fleetId}`);
  });

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Error running audit:', err);
});
