const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const latestTrip = await prisma.trip.findFirst({
    orderBy: { startTs: 'desc' }
  });
  const latestEvent = await prisma.event.findFirst({
    orderBy: { ts: 'desc' }
  });

  console.log("Latest Trip:", latestTrip ? latestTrip.startTs : "None");
  console.log("Latest Event:", latestEvent ? latestEvent.ts : "None");
  
  const now = new Date();
  console.log("Current Date:", now);
  
  await prisma.$disconnect();
}

checkData().catch(console.error);
