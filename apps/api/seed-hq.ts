import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedHq() {
  console.log('Seeding E-Moto HQ fleet...');

  let fleet = await prisma.fleet.findFirst({
    where: { name: 'E-Moto HQ' },
  });

  if (!fleet) {
    fleet = await prisma.fleet.create({
      data: {
        name: 'E-Moto HQ',
        type: 'COOP',
        plan: 'PREMIUM',
        subscriptionStatus: 'ACTIVE',
      },
    });
    console.log(`Created fleet "E-Moto HQ" with ID: ${fleet.id}`);
  } else {
    console.log(`Fleet "E-Moto HQ" already exists. ID: ${fleet.id}`);
  }

  const email = 'admin@emoto.com';
  let user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash('EmotoAdmin123!', 10);
    user = await prisma.user.create({
      data: {
        fleetId: fleet.id,
        role: 'ADMIN',
        email,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    console.log(`Created HQ user with email: ${email} and password: EmotoAdmin123!`);
  } else {
    console.log(`User ${email} already exists.`);
  }

  console.log('Done!');
}

seedHq()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
