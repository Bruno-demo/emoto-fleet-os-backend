const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { fleet: true }
  });
  
  for (const u of users) {
    console.log(`User: ${u.email || u.phone} | Role: ${u.role} | Fleet: ${u.fleet.name} (${u.fleetId})`);
  }
  
  await prisma.$disconnect();
}
main();
