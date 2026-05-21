import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PartnerService } from '../src/partner/partner.service';

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

  describe('Insurer Role API Segregation and Webhook Isolation', () => {
    let insurerUserId = '';
    let insurerClientId = '';
    let insurerClientSecret = '';
    let insurerToken = '';
    let unassignedBikeId = '';
    let assignedBikeTripId = '';
    let unassignedBikeTripId = '';
    let assignedIncidentId = '';
    let unassignedIncidentId = '';

    beforeAll(async () => {
      // Create another bike in allowedFleetId that is NOT assigned to the insurer
      const unassignedBike = await prisma.bike.create({
        data: {
          fleetId: allowedFleetId,
          label: `Bike-UNASSIGNED-${runId.slice(0, 6)}`,
          status: 'ACTIVE',
        },
      });
      unassignedBikeId = unassignedBike.id;

      // Seed insurer user record with role INSURER matching partner ID
      const insurerUser = await prisma.user.create({
        data: {
          email: `insurer-${runId.slice(0, 6)}@example.com`,
          passwordHash: await bcrypt.hash('secret123', 10),
          role: 'INSURER',
          status: 'ACTIVE',
          fleetId: allowedFleetId,
        },
      });
      insurerUserId = insurerUser.id;

      // Create a matching Partner record with the exact same UUID
      await prisma.partner.create({
        data: {
          id: insurerUserId,
          name: `InsurerPartner-${runId.slice(0, 8)}`,
          status: 'ACTIVE',
        },
      });

      // Grant fleet access to the insurer partner
      await prisma.partnerFleetAccess.create({
        data: {
          partnerId: insurerUserId,
          fleetId: allowedFleetId,
          active: true,
        },
      });

      // Create client credentials for the insurer partner
      insurerClientId = `insurer-client-${runId.slice(0, 10)}`;
      insurerClientSecret = `insurer-secret-${runId.slice(0, 16)}`;
      await prisma.partnerClient.create({
        data: {
          partnerId: insurerUserId,
          clientId: insurerClientId,
          clientSecretHash: await bcrypt.hash(insurerClientSecret, 10),
          scopes: 'insurer:read webhooks:write',
          status: 'ACTIVE',
        },
      });

      // Assign the first bike (allowedBikeId) to this insurer
      await prisma.bike.update({
        where: { id: allowedBikeId },
        data: { insurerUserId },
      });

      // Create trip for assigned bike (allowedBikeId)
      const assignedTrip = await prisma.trip.create({
        data: {
          fleetId: allowedFleetId,
          bikeId: allowedBikeId,
          startTs: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endTs: new Date(Date.now() - 23 * 60 * 60 * 1000),
          distanceKm: 5.5,
          durationSec: 3600,
          score: 95.0,
        },
      });
      assignedBikeTripId = assignedTrip.id;

      // Create trip for unassigned bike (unassignedBikeId)
      const unassignedTrip = await prisma.trip.create({
        data: {
          fleetId: allowedFleetId,
          bikeId: unassignedBikeId,
          startTs: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endTs: new Date(Date.now() - 23 * 60 * 60 * 1000),
          distanceKm: 8.0,
          durationSec: 3600,
          score: 80.0,
        },
      });
      unassignedBikeTripId = unassignedTrip.id;

      // Create devices to satisfy Event -> Device relation
      const deviceAssigned = await prisma.device.create({
        data: {
          fleetId: allowedFleetId,
          deviceUid: `device-assigned-${runId.slice(0, 6)}`,
          bikeId: allowedBikeId,
          secretHash: 'dummy-hash',
        },
      });

      const deviceUnassigned = await prisma.device.create({
        data: {
          fleetId: allowedFleetId,
          deviceUid: `device-unassigned-${runId.slice(0, 6)}`,
          bikeId: unassignedBikeId,
          secretHash: 'dummy-hash',
        },
      });

      // Create events to associate with crash incidents
      const eventAssigned = await prisma.event.create({
        data: {
          fleetId: allowedFleetId,
          bikeId: allowedBikeId,
          deviceId: deviceAssigned.id,
          ts: new Date(),
          type: 'CRASH',
          severity: 'CRITICAL',
          metaJson: { lat: -1.2, lng: 36.8 },
        },
      });

      const eventUnassigned = await prisma.event.create({
        data: {
          fleetId: allowedFleetId,
          bikeId: unassignedBikeId,
          deviceId: deviceUnassigned.id,
          ts: new Date(),
          type: 'CRASH',
          severity: 'CRITICAL',
          metaJson: { lat: -1.2, lng: 36.8 },
        },
      });

      // Create crash incidents
      const incidentAssigned = await prisma.incident.create({
        data: {
          fleetId: allowedFleetId,
          bikeId: allowedBikeId,
          deviceId: deviceAssigned.id,
          eventId: eventAssigned.id,
          status: 'OPEN',
        },
      });
      assignedIncidentId = incidentAssigned.id;

      const incidentUnassigned = await prisma.incident.create({
        data: {
          fleetId: allowedFleetId,
          bikeId: unassignedBikeId,
          deviceId: deviceUnassigned.id,
          eventId: eventUnassigned.id,
          status: 'OPEN',
        },
      });
      unassignedIncidentId = incidentUnassigned.id;

      // Authenticate the insurer client to get token
      const tokenResponse = await request(httpServer)
        .post('/partner/oauth/token')
        .send({
          clientId: insurerClientId,
          clientSecret: insurerClientSecret,
        })
        .expect(200);

      insurerToken = (tokenResponse.body as { accessToken: string }).accessToken;
    });

    it('aggregates stats only for assigned bikes in weekly summary', async () => {
      const response = await request(httpServer)
        .get(`/partner/fleets/${allowedFleetId}/weekly-summary`)
        .set('Authorization', `Bearer ${insurerToken}`)
        .expect(200);

      const body = response.body as {
        tripCount: number;
        incidentCount: number;
        avgScore: number;
      };

      // Since only allowedBikeId (assigned to insurer) has trips counted for the insurer:
      // In seedFixtures, allowedBikeId got 1 trip (dist 14.2, score 88.5).
      // In our beforeAll, allowedBikeId got 1 trip (dist 5.5, score 95.0).
      // unassignedBikeId got 1 trip (dist 8.0, score 80.0) which must NOT be counted.
      // So expected tripCount = 2, expected avgScore = (88.5 + 95.0) / 2 = 91.75
      expect(body.tripCount).toBe(2);
      expect(body.avgScore).toBeCloseTo(91.75, 1);
    });

    it('allows access to trips of assigned bike and blocks unassigned bike', async () => {
      // Allowed bike
      await request(httpServer)
        .get(`/partner/bikes/${allowedBikeId}/trips?page=1&pageSize=5`)
        .set('Authorization', `Bearer ${insurerToken}`)
        .expect(200);

      // Blocked bike
      await request(httpServer)
        .get(`/partner/bikes/${unassignedBikeId}/trips?page=1&pageSize=5`)
        .set('Authorization', `Bearer ${insurerToken}`)
        .expect(403);
    });

    it('allows access to details/evidence pack of assigned incident and blocks unassigned', async () => {
      // Incident details for assigned bike
      await request(httpServer)
        .get(`/partner/incidents/${assignedIncidentId}`)
        .set('Authorization', `Bearer ${insurerToken}`)
        .expect(200);

      // Incident details for unassigned bike
      await request(httpServer)
        .get(`/partner/incidents/${unassignedIncidentId}`)
        .set('Authorization', `Bearer ${insurerToken}`)
        .expect(403);

      // Evidence pack for assigned bike
      await request(httpServer)
        .get(`/partner/incidents/${assignedIncidentId}/evidence-pack`)
        .set('Authorization', `Bearer ${insurerToken}`)
        .expect(200);

      // Evidence pack for unassigned bike
      await request(httpServer)
        .get(`/partner/incidents/${unassignedIncidentId}/evidence-pack`)
        .set('Authorization', `Bearer ${insurerToken}`)
        .expect(403);
    });

    it('only dispatches webhooks for crash incidents on assigned bikes to insurer webhooks', async () => {
      // 1. Register webhook for insurer partner
      const webhookResponse = await request(httpServer)
        .post('/partner/webhooks')
        .set('Authorization', `Bearer ${insurerToken}`)
        .send({
          url: 'https://insurer-webhook.example.com/callback',
        })
        .expect(201);

      const insurerWebhookId = (webhookResponse.body as { id: string }).id;

      // 2. Register webhook for general partner (reusing partnerToken)
      const genWebhookResponse = await request(httpServer)
        .post('/partner/webhooks')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          url: 'https://general-webhook.example.com/callback',
        })
        .expect(201);

      const genWebhookId = (genWebhookResponse.body as { id: string }).id;

      // Load partner service to invoke enqueueCrashIncidentWebhooks directly
      const partnerService = app.get(PartnerService);

      // Trigger crash on assigned bike
      const incidentAssigned = await prisma.incident.findUnique({
        where: { id: assignedIncidentId },
        include: { event: true },
      });
      const eventAssigned = await prisma.event.findUnique({
        where: { id: incidentAssigned.eventId },
      });

      await partnerService.enqueueCrashIncidentWebhooks(
        {
          ...incidentAssigned,
          eventId: incidentAssigned.eventId,
        },
        {
          ...eventAssigned,
          id: eventAssigned.id,
        },
      );

      // Verify notification is created for BOTH general and insurer webhook
      const genNotifAssigned = await prisma.notification.findFirst({
        where: { partnerWebhookId: genWebhookId },
      });
      const insurerNotifAssigned = await prisma.notification.findFirst({
        where: { partnerWebhookId: insurerWebhookId },
      });

      expect(genNotifAssigned).toBeDefined();
      expect(genNotifAssigned?.to).toBe('https://general-webhook.example.com/callback');
      expect(insurerNotifAssigned).toBeDefined();
      expect(insurerNotifAssigned?.to).toBe('https://insurer-webhook.example.com/callback');

      // Now clear notifications from the database
      await prisma.notification.deleteMany({
        where: { partnerWebhookId: { in: [genWebhookId, insurerWebhookId] } },
      });

      // Trigger crash on unassigned bike
      const incidentUnassigned = await prisma.incident.findUnique({
        where: { id: unassignedIncidentId },
        include: { event: true },
      });
      const eventUnassigned = await prisma.event.findUnique({
        where: { id: incidentUnassigned.eventId },
      });

      await partnerService.enqueueCrashIncidentWebhooks(
        {
          ...incidentUnassigned,
          eventId: incidentUnassigned.eventId,
        },
        {
          ...eventUnassigned,
          id: eventUnassigned.id,
        },
      );

      // Verify notification is created for general partner but NOT for insurer partner
      const genNotifUnassigned = await prisma.notification.findFirst({
        where: { partnerWebhookId: genWebhookId },
      });
      const insurerNotifUnassigned = await prisma.notification.findFirst({
        where: { partnerWebhookId: insurerWebhookId },
      });

      expect(genNotifUnassigned).toBeDefined();
      expect(genNotifUnassigned?.to).toBe('https://general-webhook.example.com/callback');
      expect(insurerNotifUnassigned).toBeNull();
    });
  });
});
