import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Verifying TimescaleDB extension and hypertables...');
  
  // 1. Create extension
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb;`);
  
  // 2. Convert TelemetryPoint to hypertable
  try {
    await prisma.$executeRawUnsafe(`SELECT create_hypertable('"TelemetryPoint"', 'time', if_not_exists => true);`);
    console.log('   TelemetryPoint converted to TimescaleDB hypertable.');
  } catch (err: any) {
    console.log('   TelemetryPoint hypertable status:', err.message);
  }

  // 3. Set compression policy
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TelemetryPoint" SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = '"deviceId"'
    );`);
  } catch (err: any) {
    // Ignore if already set
  }
  try {
    await prisma.$executeRawUnsafe(`SELECT add_compression_policy('"TelemetryPoint"', INTERVAL '7 days', if_not_exists => true);`);
    console.log('   Compression policy set (7 days).');
  } catch (err: any) {
    console.log('   Compression policy check:', err.message);
  }

  // 4. Set retention policy
  try {
    await prisma.$executeRawUnsafe(`SELECT add_retention_policy('"TelemetryPoint"', INTERVAL '180 days', if_not_exists => true);`);
    console.log('   Retention policy set (180 days).');
  } catch (err: any) {
    console.log('   Retention policy check:', err.message);
  }

  console.log('TimescaleDB setup check completed successfully!');
}

void main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
