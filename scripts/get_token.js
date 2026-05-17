const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { ConfigService } = require('@nestjs/config');

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { phone: '+254700000000' },
    include: { fleet: true }
  });
  
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  const jwtService = new JwtService({
    secret: 'your-secret-key-from-env', // I need the actual secret
  });

  const payload = {
    sub: user.id,
    fleetId: user.fleetId,
    role: user.role,
  };

  const token = jwtService.sign(payload, { expiresIn: '1h' });
  console.log(token);
  await prisma.$disconnect();
}
// main(); // I need the secret
