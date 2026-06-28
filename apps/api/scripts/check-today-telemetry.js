const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Connecting to database...');
    
    const points = await prisma.telemetryPoint.findMany({
      where: {
        deviceId: 'c739b7f9-92bc-402c-8e84-9ef9a59b10ed'
      },
      orderBy: {
        ts: 'desc'
      },
      take: 10
    });

    console.log(`Found ${points.length} telemetry points in the database:`);
    points.forEach((p, idx) => {
      console.log(`[${idx + 1}] ID: ${p.id} | TS: ${p.ts.toISOString()} | Coord: ${p.lat}, ${p.lng} | Speed: ${p.speedKph} km/h | Ignition: ${p.ignition}`);
    });

  } catch (err) {
    console.error('Error checking telemetry:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
