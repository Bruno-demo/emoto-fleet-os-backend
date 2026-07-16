const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Restoring schema permissions for emoto_app...');
    await prisma.$executeRawUnsafe(`GRANT CONNECT ON DATABASE postgres TO emoto_app;`);
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO emoto_app;`);
    await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO emoto_app;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO emoto_app;`);
    await prisma.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO emoto_app;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO emoto_app;`);
    console.log('Permissions successfully restored to emoto_app!');
  } catch (error) {
    console.error('Failed to restore permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
