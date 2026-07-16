const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking database content...');

  // 1. Check users
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users:`, users.map(u => u.email));

  // 2. Check fleets
  const fleets = await prisma.fleet.findMany();
  console.log(`Found ${fleets.length} fleets:`, fleets.map(f => f.name));

  // 3. Wipe all other tables
  console.log('Wiping all tables other than Super Admin and HQ Fleet...');

  try {
    // Delete in order of dependencies to avoid foreign key errors
    await prisma.billingPayment.deleteMany();
    await prisma.billingCycle.deleteMany();
    await prisma.registrationInvite.deleteMany();
    await prisma.partnerWebhook.deleteMany();
    await prisma.partnerFleetAccess.deleteMany();
    await prisma.partnerClient.deleteMany();
    await prisma.partner.deleteMany();
    await prisma.poi.deleteMany();
    await prisma.bikeAssignment.deleteMany();
    await prisma.riderProfile.deleteMany();
    await prisma.geofenceZone.deleteMany();
    await prisma.roadFeature.deleteMany();
    await prisma.deviceCommand.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.evidencePack.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.event.deleteMany();
    await prisma.telemetryPoint.deleteMany();
    await prisma.bike.deleteMany();
    await prisma.device.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.delivery.deleteMany();
    await prisma.riderPayment.deleteMany();

    // Wipe extra users (keeping only Bruno)
    const deleteUsersResult = await prisma.user.deleteMany({
      where: {
        email: { not: 'bruno@emotofleet.com' }
      }
    });
    console.log(`Deleted ${deleteUsersResult.count} extra users.`);

    // Wipe extra fleets (keeping only E-Moto HQ)
    const deleteFleetsResult = await prisma.fleet.deleteMany({
      where: {
        id: { not: '00000000-0000-0000-0000-000000000000' }
      }
    });
    console.log(`Deleted ${deleteFleetsResult.count} extra fleets.`);

    console.log('Database wipe completed successfully! Only E-Moto HQ and bruno@emotofleet.com remain.');
  } catch (error) {
    console.error('Error during wipe:', error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
