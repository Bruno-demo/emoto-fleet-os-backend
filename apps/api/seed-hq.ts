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
        plan: 'PAYG',
        subscriptionStatus: 'ACTIVE',
      },
    });
    console.log(`Created fleet "E-Moto HQ" with ID: ${fleet.id}`);
  } else {
    console.log(`Fleet "E-Moto HQ" already exists. ID: ${fleet.id}`);
  }

  const admins = [
    { email: 'admin@emoto.com', password: 'EmotoAdmin123!' },
    { email: 'bruno@emotofleet.com', password: 'Nadia2005' },
  ];

  for (const admin of admins) {
    let user = await prisma.user.findFirst({
      where: { email: admin.email },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      user = await prisma.user.create({
        data: {
          fleetId: fleet.id,
          role: 'ADMIN',
          email: admin.email,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      console.log(`Created HQ user with email: ${admin.email} and password: ${admin.password}`);
    } else {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fleetId: fleet.id,
          role: 'ADMIN',
          passwordHash,
          status: 'ACTIVE',
        },
      });
      console.log(`User ${admin.email} updated to HQ Admin with password: ${admin.password}`);
    }
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
