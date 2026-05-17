const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const bikeId = '00000000-0000-0000-0000-000000000411';
  const bike = await prisma.bike.findUnique({
    where: { id: bikeId },
    include: { devices: true }
  });
  console.log('Bike and Devices:', JSON.stringify(bike, null, 2));

  const userPhone = '+254700000000';
  const user = await prisma.user.findFirst({
    where: { phone: userPhone },
    include: { bikeAssignments: true }
  });
  console.log('\nUser and Assignments:', JSON.stringify(user, null, 2));
  
  await prisma.$disconnect();
}
check();
