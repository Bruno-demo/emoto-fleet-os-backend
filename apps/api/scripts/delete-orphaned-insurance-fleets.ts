import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup of orphaned insurance fleets...');

  // Find all fleets with plan 'INSURANCE'
  const insuranceFleets = await prisma.fleet.findMany({
    where: { plan: 'INSURANCE' },
    include: {
      users: true,
    },
  });

  console.log(`Found ${insuranceFleets.length} total insurance fleets in database.`);

  const orphanedFleets = insuranceFleets.filter((f) => f.users.length === 0);
  console.log(`Found ${orphanedFleets.length} orphaned insurance fleets (no active users).`);

  if (orphanedFleets.length === 0) {
    console.log('✅ No orphaned insurance fleets to clean up.');
    return;
  }

  for (const fleet of orphanedFleets) {
    console.log(`Deleting orphaned fleet: "${fleet.name}" (ID: ${fleet.id})...`);
    await prisma.fleet.delete({
      where: { id: fleet.id },
    });
  }

  console.log('✅ Cleanup completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
