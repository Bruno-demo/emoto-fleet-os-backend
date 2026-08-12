const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function nuclearSchemaReset() {
  console.log('☢️ Starting Nuclear Database Reset (Wiping all data and legacy enums)...');
  try {
    // 1. Drop public schema with CASCADE to remove all legacy tables, types, and enums
    console.log('1. Dropping public schema...');
    await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE;`);
    
    // 2. Recreate blank public schema
    console.log('2. Recreating blank public schema...');
    await prisma.$executeRawUnsafe(`CREATE SCHEMA public;`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public;`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO current_user;`);

    console.log('✅ PUBLIC SCHEMA DROPPED & RECREATED CLEANLY!');
    console.log('💡 Now run `npm run db:push -w apps/api` or `npm run db:deploy -w apps/api` to apply fresh schema.');
  } catch (err) {
    console.error('❌ Schema reset failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

nuclearSchemaReset();
