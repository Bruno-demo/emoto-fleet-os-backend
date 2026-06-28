const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Connecting to database...');
    
    // Wipe all records from the Trip table
    const deleteResult = await prisma.trip.deleteMany({});
    console.log(`Successfully deleted ${deleteResult.count} trip records from the database.`);
  } catch (err) {
    console.error('Error during trip deletion:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
