const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Connecting to database...');
    // Delete any telemetry points that are out of bounds or mapped to Bolivia
    const result = await prisma.telemetryPoint.deleteMany({
      where: {
        OR: [
          { lat: { lt: -10 } },
          { lng: { gt: 180 } }
        ]
      }
    });
    console.log(`Successfully deleted ${result.count} bad telemetry points from the database.`);
  } catch (err) {
    console.error('Error deleting bad telemetry:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
