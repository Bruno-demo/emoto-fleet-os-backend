const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function shiftDates() {
  console.log("Fetching latest trip date...");
  const latestTrip = await prisma.trip.findFirst({
    orderBy: { startTs: 'desc' }
  });

  if (!latestTrip) {
    console.log("No trips found in database.");
    return;
  }

  const latestDate = new Date(latestTrip.startTs);
  const now = new Date();
  
  // Calculate difference in milliseconds
  const diffMs = now.getTime() - latestDate.getTime();
  
  // Convert to days (approximate, since we just need them to be recent)
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    console.log("Data is already up to date.");
    return;
  }

  console.log(`Shifting all dates forward by ${diffDays} days...`);

  // We can use Prisma raw queries to shift dates efficiently
  const intervalStr = `${diffDays} days`;

  try {
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`UPDATE "Trip" SET "startTs" = "startTs" + interval '${intervalStr}', "endTs" = "endTs" + interval '${intervalStr}' WHERE "endTs" IS NOT NULL;`),
      prisma.$executeRawUnsafe(`UPDATE "Trip" SET "startTs" = "startTs" + interval '${intervalStr}' WHERE "endTs" IS NULL;`),
      prisma.$executeRawUnsafe(`UPDATE "Trip" SET "createdAt" = "createdAt" + interval '${intervalStr}';`),
      
      prisma.$executeRawUnsafe(`UPDATE "Event" SET "ts" = "ts" + interval '${intervalStr}', "createdAt" = "createdAt" + interval '${intervalStr}';`),
      
      // Removed TelemetryPoint update since it's a TimescaleDB hypertable which restricts UPDATEs across chunks
      
      prisma.$executeRawUnsafe(`UPDATE "DeviceCommand" SET "requestedAt" = "requestedAt" + interval '${intervalStr}', "sentAt" = "sentAt" + interval '${intervalStr}', "ackedAt" = "ackedAt" + interval '${intervalStr}', "expiresAt" = "expiresAt" + interval '${intervalStr}', "createdAt" = "createdAt" + interval '${intervalStr}', "updatedAt" = "updatedAt" + interval '${intervalStr}';`),
      
      prisma.$executeRawUnsafe(`UPDATE "Incident" SET "createdAt" = "createdAt" + interval '${intervalStr}', "updatedAt" = "updatedAt" + interval '${intervalStr}', "acknowledgedAt" = "acknowledgedAt" + interval '${intervalStr}', "resolvedAt" = "resolvedAt" + interval '${intervalStr}';`),

      prisma.$executeRawUnsafe(`UPDATE "ScoreSummary" SET "periodStart" = "periodStart" + interval '${intervalStr}', "periodEnd" = "periodEnd" + interval '${intervalStr}', "createdAt" = "createdAt" + interval '${intervalStr}';`)
    ]);
    
    console.log("Successfully shifted all dates!");
    
    // Check new latest date
    const newLatest = await prisma.trip.findFirst({
      orderBy: { startTs: 'desc' }
    });
    console.log("New latest trip startTs:", newLatest.startTs);
    
  } catch (err) {
    console.error("Error executing raw updates:", err);
  } finally {
    await prisma.$disconnect();
  }
}

shiftDates().catch(console.error);
