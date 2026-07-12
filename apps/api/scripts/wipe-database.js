const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('Querying database tables...');
    
    // Get all public tables
    const tablenames = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    // Filter out Prisma migrations table to keep schema history
    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== '_prisma_migrations');

    console.log(`Found ${tables.length} tables to truncate:`, tables);

    // Truncate all tables with CASCADE
    console.log('Truncating tables...');
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`Truncated table: ${table}`);
    }

    console.log('Database successfully wiped! All seeded data has been cleared.');
  } catch (error) {
    console.error('Failed to wipe database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
