const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fleets = await prisma.fleet.findMany({
    include: {
      bikes: true,
      users: { where: { role: 'RIDER' }, take: 1 }
    }
  });

  for (const fleet of fleets) {
    console.log(`Seeding demo data for fleet: ${fleet.name} (${fleet.id})...`);
    
    // We need a device for events and incidents
    const device = await prisma.device.findFirst({ where: { fleetId: fleet.id } });
    if (!device) {
      console.log(`  Skipping ${fleet.name} - no device found.`);
      continue;
    }
    
    const bike = fleet.bikes[0];
    const user = fleet.users[0];
    if (!bike || !user) {
      console.log(`  Skipping ${fleet.name} - missing bike or rider.`);
      continue;
    }

    try {
      const trips = [];
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const startTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000 - Math.random() * 5 * 60 * 60 * 1000);
        const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);
        
        trips.push({
          fleetId: fleet.id,
          bikeId: bike.id,
          riderId: user.id,
          startTs: startTime,
          endTs: endTime,
          distanceKm: 10 + i + Math.random() * 5,
          durationSec: 2700,
          score: 80 + Math.floor(Math.random() * 15),
          startBatteryPct: 95 - i * 2,
          endBatteryPct: 80 - i * 2,
        });
      }

      for (const trip of trips) {
        await prisma.trip.create({ data: trip });
      }

      const theTrips = await prisma.trip.findMany({ where: { fleetId: fleet.id }, take: 2, orderBy: { startTs: 'desc' } });

      if (theTrips.length >= 2) {
        const events = [
          {
            fleetId: fleet.id,
            bikeId: bike.id,
            deviceId: device.id,
            type: 'OVERSPEED',
            severity: 'LOW',
            ts: new Date(theTrips[0].startTs.getTime() + 10 * 60 * 1000),
            metaJson: { speed: 65, limit: 60, lat: -1.9441, lng: 30.0619 },
          },
          {
            fleetId: fleet.id,
            bikeId: bike.id,
            deviceId: device.id,
            type: 'HARSH_BRAKE',
            severity: 'MEDIUM',
            ts: new Date(theTrips[1].startTs.getTime() + 15 * 60 * 1000),
            metaJson: { gForce: 0.8, lat: -1.9450, lng: 30.0600 },
          }
        ];

        const createdEvents = [];
        for (const event of events) {
          const e = await prisma.event.create({ data: event });
          createdEvents.push(e);
        }

        await prisma.incident.create({
          data: {
            fleetId: fleet.id,
            bikeId: bike.id,
            deviceId: device.id,
            eventId: createdEvents[1].id,
            status: 'OPEN',
            createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            notes: 'Suspicious movement while locked. Bike moved 50m without being unlocked.',
          }
        });
      }

      console.log(`  Success seeding ${fleet.name}`);
    } catch (error) {
      console.error(`  Error seeding demo data for ${fleet.name}:`, error);
    }
  }

  await prisma.$disconnect();
}

main();
