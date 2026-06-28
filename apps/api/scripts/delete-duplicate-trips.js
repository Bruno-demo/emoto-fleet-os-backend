const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Connecting to database...');
    
    // Fetch all trips ordered by bikeId and start time
    const trips = await prisma.trip.findMany({
      orderBy: [
        { bikeId: 'asc' },
        { startTs: 'asc' },
        { id: 'asc' }
      ]
    });

    const deleteIds = [];
    let prevTrip = null;

    for (const trip of trips) {
      if (prevTrip && 
          prevTrip.bikeId === trip.bikeId && 
          prevTrip.startTs.getTime() === trip.startTs.getTime()) {
        // Duplicate found: same bike and same start time.
        deleteIds.push(trip.id);
      } else {
        prevTrip = trip;
      }
    }

    console.log(`Found ${deleteIds.length} duplicate trips out of ${trips.length} total trips.`);

    if (deleteIds.length > 0) {
      const deleteResult = await prisma.trip.deleteMany({
        where: {
          id: {
            in: deleteIds
          }
        }
      });
      console.log(`Successfully deleted ${deleteResult.count} duplicate trip records.`);
    } else {
      console.log('No duplicate trips found to delete.');
    }

  } catch (err) {
    console.error('Error during duplicate trips audit:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
