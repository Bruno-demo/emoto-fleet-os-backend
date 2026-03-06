import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Partner OAuth and Insurer API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let allowedFleetId = '';
  let deniedFleetId = '';
  let allowedBikeId = '';
  let partnerClientId = '';
  let partnerClientSecret = '';
  let partnerToken = '';
  const runId = randomUUID().replace(/-/g, '');

  // Seeds partner and fleet fixtures for partner-token and fleet-isolation assertions.
  const seedFixtures = async (): Promise<void> => {
    const allowedFleet = await prisma.fleet.create({
      data: {
        name: `Partner Allowed Fleet ${runId.slice(0, 6)}`,
        type: 'DELIVERY',
      },
    });
    allowedFleetId = allowedFleet.id;

    const deniedFleet = await prisma.fleet.create({
      data: {
        name: `Partner Denied Fleet ${runId.slice(0, 6)}`,
        type: 'COOP',
      },
    });
    deniedFleetId = deniedFleet.id;

    const bike = await prisma.bike.create({
      data: {
        fleetId: allowedFleetId,
        label: `Bike-PARTNER-${runId.slice(0, 6)}`,
        status: 'ACTIVE',
      },
    });
    allowedBikeId = bike.id;

    await prisma.trip.create({
      data: {
        fleetId: allowedFleetId,
        bikeId: allowedBikeId,
        startTs: new Date(Date.now() - 60 * 60 * 1000),
        endTs: new Date(Date.now() - 30 * 60 * 1000),
        distanceKm: 14.2,
        durationSec: 1800,
        score: 88.5,
      },
    });

    const partner = await prisma.partner.create({
      data: {
        name: `Partner-${runId.slice(0, 8)}`,
        status: 'ACTIVE',
      },
    });

    partnerClientId = `partner-client-${runId.slice(0, 10)}`;
    partnerClientSecret = `partner-secret-${runId.slice(0, 16)}`;
    await prisma.partnerClient.create({
      data: {
        partnerId: partner.id,
        clientId: partnerClientId,
        clientSecretHash: await bcrypt.hash(partnerClientSecret, 10),
        scopes: 'insurer:read webhooks:write',
        status: 'ACTIVE',
      },
    });

    await prisma.partnerFleetAccess.create({
      data: {
        partnerId: partner.id,
        fleetId: allowedFleetId,
        active: true,
      },
    });
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    await seedFixtures();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
  });

  it('issues a partner token with client credentials', async () => {
    const tokenResponse = await request(httpServer)
      .post('/partner/oauth/token')
      .send({
        clientId: partnerClientId,
        clientSecret: partnerClientSecret,
      })
      .expect(200);

    const body = tokenResponse.body as {
      accessToken: string;
      tokenType: string;
      scopes: string[];
    };
    expect(body.accessToken).toBeDefined();
    expect(body.tokenType).toBe('Bearer');
    expect(body.scopes).toContain('insurer:read');
    partnerToken = body.accessToken;
  });

  it('allows partner access only to granted fleets', async () => {
    const allowedResponse = await request(httpServer)
      .get(`/partner/fleets/${allowedFleetId}/weekly-summary`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200);

    const allowedBody = allowedResponse.body as {
      fleetId: string;
      tripCount: number;
      avgScore: number;
    };
    expect(allowedBody.fleetId).toBe(allowedFleetId);
    expect(allowedBody.tripCount).toBeGreaterThan(0);
    expect(allowedBody.avgScore).toBeGreaterThan(0);

    await request(httpServer)
      .get(`/partner/fleets/${deniedFleetId}/weekly-summary`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(403);
  });

  it('returns partner-safe bike trip summaries without telemetry points', async () => {
    const response = await request(httpServer)
      .get(`/partner/bikes/${allowedBikeId}/trips?page=1&pageSize=5`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200);

    const body = response.body as {
      data: Array<Record<string, unknown>>;
    };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0]).not.toHaveProperty('telemetry');
    expect(body.data[0]).not.toHaveProperty('points');
  });
});
