import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  let partner = await prisma.partner.findFirst({
    include: {
      clients: true,
      fleetAccesses: true,
      webhooks: true,
    }
  });

  if (!partner) {
    console.log('No partner found. Creating one...');
    partner = await prisma.partner.create({
      data: {
        name: 'Test Partner',
        clients: {
          create: {
            clientId: 'test-client-id-' + Date.now(),
            clientSecretHash: 'hash',
            scopes: 'read',
          }
        },
        fleetAccesses: {
          create: {
            fleet: {
              create: {
                name: 'Test Fleet for Partner Delete',
                slug: 'test-fleet-partner-delete-' + Date.now(),
                billingConfig: {
                  create: {
                    dailyRate: 10,
                  }
                }
              }
            }
          }
        },
        webhooks: {
          create: {
            url: 'https://example.com/webhook',
            secretHash: 'hash',
          }
        }
      },
      include: {
        clients: true,
        fleetAccesses: true,
        webhooks: true,
      }
    });
    console.log('Created test partner:', partner.id);
  } else {
    console.log('Found existing partner:', partner.id);
  }

  if (partner.webhooks.length > 0) {
    const webhook = partner.webhooks[0];
    const fleetAccess = partner.fleetAccesses[0];
    if (fleetAccess) {
      console.log('Creating notification on webhook:', webhook.id);
      await prisma.notification.create({
        data: {
          fleetId: fleetAccess.fleetId,
          type: 'BIKE_CRASH',
          channel: 'PARTNER_WEBHOOK',
          to: webhook.url,
          payloadJson: {},
          partnerWebhookId: webhook.id,
        }
      });
    }
  }

  console.log('Attempting to delete partner:', partner.id);
  try {
    const result = await prisma.partner.delete({
      where: { id: partner.id }
    });
    console.log('Partner deleted successfully:', result);
  } catch (err: any) {
    console.error('Error deleting partner:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
