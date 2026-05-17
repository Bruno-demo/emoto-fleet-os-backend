const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fleetId = '00000000-0000-0000-0000-000000000004';
  const userId = '00000000-0000-0000-0000-000000000401';
  const bikeId = '00000000-0000-0000-0000-000000000411';

  console.log('Seeding demo data for fleet dashboard...');

  try {
    // 1. Create some Trips
    const trips = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const startTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 45 * 60 * 1000); // 45 min trip
      
      trips.push({
        id: `00000000-0000-0000-0000-000000000${500 + i}`,
        fleetId,
        bikeId,
        riderId: userId,
        startTs: startTime,
        endTs: endTime,
        distanceKm: 12.5 + i,
        durationSec: 2700,
        score: 85 + (i % 10),
        startBatteryPct: 95 - i * 5,
        endBatteryPct: 80 - i * 5,
      });
    }

    for (const trip of trips) {
      await prisma.trip.upsert({
        where: { id: trip.id },
        update: {},
        create: trip,
      });
    }

    // 2. Create some Events
    // Need a deviceId to relate the events and incidents
    const deviceId = 'b8455bd9-165c-4d37-bf80-efedccdde8e1'; // From the database query

    const events = [
      {
        fleetId,
        bikeId,
        deviceId, // Add deviceId
        tripId: trips[0].id,
        type: 'OVERSPEED',
        severity: 'LOW',
        ts: new Date(trips[0].startTs.getTime() + 10 * 60 * 1000),
        metaJson: { speed: 65, limit: 60, lat: -1.9441, lng: 30.0619 },
      },
      {
        fleetId,
        bikeId,
        deviceId, // Add deviceId
        tripId: trips[1].id,
        type: 'HARSH_BRAKE',
        severity: 'MEDIUM',
        ts: new Date(trips[1].startTs.getTime() + 15 * 60 * 1000),
        metaJson: { gForce: 0.8, lat: -1.9450, lng: 30.0600 },
      }
    ];

    const createdEvents = [];
    for (const event of events) {
      // Need to delete tripId since it is not on the schema
      const { tripId, ...eventData } = event;
      const createdEvent = await prisma.event.create({ data: eventData });
      createdEvents.push(createdEvent);
    }

    // 3. Create an incident from the second event
    await prisma.incident.create({
      data: {
        fleetId,
        bikeId,
        deviceId, // Add deviceId
        eventId: createdEvents[1].id, // Add eventId
        status: 'OPEN',
        createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        notes: 'Suspicious movement while locked. Bike moved 50m without being unlocked.',
      }
    });

    console.log('Demo data seeded successfully!');
  } catch (error) {
    console.error('Error seeding demo data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
