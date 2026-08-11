import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const hqFleetId = '00000000-0000-0000-0000-000000000000';
  const hqAdminEmail = 'bruno@emotofleet.com';
  const hqAdminPassword = 'Nadia2005';
  
  // Upsert the E-Moto HQ fleet first
  await prisma.fleet.upsert({
    where: { id: hqFleetId },
    update: { name: 'E-Moto HQ', type: 'DELIVERY', plan: 'PAYG', subscriptionStatus: 'ACTIVE' },
    create: { id: hqFleetId, name: 'E-Moto HQ', type: 'DELIVERY', plan: 'PAYG', subscriptionStatus: 'ACTIVE' },
  });

  const BCRYPT_SALT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash(hqAdminPassword, BCRYPT_SALT_ROUNDS);

  // Upsert the user
  const user = await prisma.user.upsert({
    where: { fleetId_email: { fleetId: hqFleetId, email: hqAdminEmail } },
    update: { role: 'ADMIN', passwordHash: passwordHash, status: 'ACTIVE' },
    create: {
      fleetId: hqFleetId,
      role: 'ADMIN',
      email: hqAdminEmail,
      passwordHash: passwordHash,
      status: 'ACTIVE'
    },
  });

  console.log(`Success: HQ Super Admin user seeded successfully!`);
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
