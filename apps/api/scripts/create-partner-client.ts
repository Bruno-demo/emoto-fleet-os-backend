import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Parses integer-like environment values with safe fallback.
function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Creates or reuses a partner record, then upserts one OAuth client and optional fleet access.
async function main(): Promise<void> {
  const partnerName = process.env.PARTNER_NAME ?? 'Demo Insurer Partner';
  const partnerClientId = process.env.PARTNER_CLIENT_ID ?? `partner-${Date.now()}`;
  const partnerClientSecret =
    process.env.PARTNER_CLIENT_SECRET ?? randomBytes(24).toString('hex');
  const partnerScopes =
    process.env.PARTNER_SCOPES ?? 'insurer:read webhooks:write';
  const partnerFleetId = process.env.PARTNER_FLEET_ID;
  const bcryptRounds = parseIntEnv(process.env.BCRYPT_SALT_ROUNDS, 10);
  const partnerClientSecretHash = await bcrypt.hash(
    partnerClientSecret,
    bcryptRounds,
  );

  const partnerId = process.env.PARTNER_ID ?? randomUUID();
  const existingPartner = await prisma.partner.findFirst({
    where: { name: partnerName },
    select: { id: true },
  });
  const partner = existingPartner
    ? await prisma.partner.update({
        where: { id: existingPartner.id },
        data: { status: 'ACTIVE' },
      })
    : await prisma.partner.create({
        data: {
          id: partnerId,
          name: partnerName,
          status: 'ACTIVE',
        },
      });

  const partnerClient = await prisma.partnerClient.upsert({
    where: {
      clientId: partnerClientId,
    },
    update: {
      partnerId: partner.id,
      clientSecretHash: partnerClientSecretHash,
      scopes: partnerScopes,
      status: 'ACTIVE',
    },
    create: {
      partnerId: partner.id,
      clientId: partnerClientId,
      clientSecretHash: partnerClientSecretHash,
      scopes: partnerScopes,
      status: 'ACTIVE',
    },
  });

  if (partnerFleetId) {
    await prisma.partnerFleetAccess.upsert({
      where: {
        partnerId_fleetId: {
          partnerId: partner.id,
          fleetId: partnerFleetId,
        },
      },
      update: {
        active: true,
      },
      create: {
        partnerId: partner.id,
        fleetId: partnerFleetId,
        active: true,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        partnerId: partner.id,
        partnerName: partner.name,
        clientId: partnerClient.clientId,
        clientSecret: partnerClientSecret,
        scopes: partnerClient.scopes,
        fleetAccessGranted: Boolean(partnerFleetId),
        fleetId: partnerFleetId ?? null,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
