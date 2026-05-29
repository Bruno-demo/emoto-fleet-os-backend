const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin.01@demo.emoto' }
  });

  if (!user) {
    console.error('User admin@demo.emoto NOT FOUND in database!');
    return;
  }

  console.log('User found:', {
    email: user.email,
    role: user.role,
    status: user.status,
    passwordHash: user.passwordHash
  });

  const match1 = await bcrypt.compare('ChangeMe123!', user.passwordHash);
  console.log('Password match for ChangeMe123!:', match1);

  const match2 = await bcrypt.compare('ChangeMe123', user.passwordHash);
  console.log('Password match for ChangeMe123 (no exclamation):', match2);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
