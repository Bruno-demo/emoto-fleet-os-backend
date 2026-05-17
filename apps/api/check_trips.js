const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fleetId = '00000000-0000-0000-0000-000000000004';
  const tripCount = await prisma.trip.count({ where: { fleetId } });
  console.log(`Trip count for demo fleet: ${tripCount}`);
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentTripCount = await prisma.trip.count({
    where: { fleetId, startTs: { gte: sevenDaysAgo } }
  });
  console.log(`Recent trips (last 7 days): ${recentTripCount}`);
  
  await prisma.$disconnect();
}
main();
