const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceWipeAndReset() {
  console.log('⚡ Starting Emergency Force Wipe & Schema Clean...');
  try {
    // 1. Force update any invalid enum text values using raw SQL first
    console.log('1. Sanitizing raw SQL enum columns...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Fleet" ALTER COLUMN "plan" DROP DEFAULT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE TEXT USING "planCode"::text;`);
      await prisma.$executeRawUnsafe(`UPDATE "Fleet" SET "plan" = 'PAYG' WHERE "plan" NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');`);
      await prisma.$executeRawUnsafe(`UPDATE "PricingTier" SET "planCode" = 'PAYG' WHERE "planCode" NOT IN ('PAYG', 'INSURANCE', 'ENTERPRISE');`);
      await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "FleetPlan" CASCADE;`);
      await prisma.$executeRawUnsafe(`CREATE TYPE "FleetPlan" AS ENUM ('PAYG', 'INSURANCE', 'ENTERPRISE');`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Fleet" ALTER COLUMN "plan" TYPE "FleetPlan" USING "plan"::"FleetPlan";`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Fleet" ALTER COLUMN "plan" SET DEFAULT 'PAYG';`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "PricingTier" ALTER COLUMN "planCode" TYPE "FleetPlan" USING "planCode"::"FleetPlan";`);
      console.log('✅ SQL enum sanitization completed.');
    } catch (e) {
      console.log('⚠️ Enum sanitization notice:', e.message);
    }

    // 2. Fetch all public tables and TRUNCATE with CASCADE
    console.log('2. Truncating all public database tables...');
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname='public';
    `;

    for (const { tablename } of tables) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
        console.log(`   - Truncated table: ${tablename}`);
      }
    }

    console.log('✅ ALL DATABASE DATA WIPED CLEANLY!');
    console.log('💡 Database structure is now clean.');
  } catch (err) {
    console.error('❌ Force wipe failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

forceWipeAndReset();
