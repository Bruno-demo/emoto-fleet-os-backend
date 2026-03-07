import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EventSeverity,
  EventType,
  NotificationType,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Rider APIs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let riderToken = '';
  let fleetId = '';
  let riderUserId = '';
  let bikeId = '';
  let deviceId = '';
  let ownTripId = '';
  let otherRiderTripId = '';
  let emergencyPhone = '';
  const runId = randomUUID().replace(/-/g, '');
  const riderPhone = `+2507${runId.slice(0, 8)}`;
  const riderPassword = 'RiderPass123!';
  const otherRiderPhone = `+2506${runId.slice(0, 8)}`;

  // Seeds one fleet with two riders, bike assignment, trips, and emergency contacts.
  const seedFixtures = async (): Promise<void> => {
    const riderPasswordHash = await bcrypt.hash(riderPassword, 10);
    const otherRiderPasswordHash = await bcrypt.hash('OtherRider123!', 10);

    const fleet = await prisma.fleet.create({
      data: {
        name: `Rider Fleet ${runId.slice(0, 6)}`,
        type: 'DELIVERY',
      },
    });
    fleetId = fleet.id;

    const rider = await prisma.user.create({
      data: {
        fleetId,
        role: 'RIDER',
        phone: riderPhone,
        passwordHash: riderPasswordHash,
        status: 'ACTIVE',
      },
    });
    riderUserId = rider.id;

    await prisma.riderProfile.create({
      data: {
        userId: rider.id,
        fullName: 'Primary Rider',
      },
    });

    const otherRider = await prisma.user.create({
      data: {
        fleetId,
        role: 'RIDER',
        phone: otherRiderPhone,
        passwordHash: otherRiderPasswordHash,
        status: 'ACTIVE',
      },
    });

    await prisma.riderProfile.create({
      data: {
        userId: otherRider.id,
        fullName: 'Secondary Rider',
      },
    });

    const bike = await prisma.bike.create({
      data: {
        fleetId,
        label: `Bike-RIDER-${runId.slice(0, 6)}`,
        status: 'ACTIVE',
      },
    });
    bikeId = bike.id;

    const device = await prisma.device.create({
      data: {
        fleetId,
        bikeId: bike.id,
        deviceUid: `DEV-RIDER-${runId.slice(0, 8)}`,
        status: 'ACTIVE',
        secretHash: 'seeded-hash-rider',
      },
    });
    deviceId = device.id;

    await prisma.bikeAssignment.create({
      data: {
        fleetId,
        bikeId: bike.id,
        riderUserId: rider.id,
        active: true,
      },
    });

    emergencyPhone = `+250700${Date.now().toString().slice(-6)}`;
    await prisma.emergencyContact.create({
      data: {
        fleetId,
        name: 'Dispatch Emergency',
        phone: emergencyPhone,
        role: 'DISPATCH',
        active: true,
      },
    });

    const ownTrip = await prisma.trip.create({
      data: {
        fleetId,
        bikeId: bike.id,
        riderId: rider.id,
        startTs: new Date('2026-03-06T09:00:00.000Z'),
        endTs: new Date('2026-03-06T09:20:00.000Z'),
        distanceKm: 12.4,
        durationSec: 1200,
        score: 88.5,
      },
    });
    ownTripId = ownTrip.id;

    const otherTrip = await prisma.trip.create({
      data: {
        fleetId,
        bikeId: bike.id,
        riderId: otherRider.id,
        startTs: new Date('2026-03-06T10:00:00.000Z'),
        endTs: new Date('2026-03-06T10:15:00.000Z'),
        distanceKm: 7.3,
        durationSec: 900,
        score: 72.4,
      },
    });
    otherRiderTripId = otherTrip.id;

    await prisma.event.createMany({
      data: [
        {
          fleetId,
          bikeId,
          deviceId,
          ts: new Date('2026-03-06T09:05:00.000Z'),
          type: EventType.OVERSPEED,
          severity: EventSeverity.MEDIUM,
          metaJson: { source: 'test' },
        },
        {
          fleetId,
          bikeId,
          deviceId,
          ts: new Date('2026-03-06T09:06:00.000Z'),
          type: EventType.HARSH_BRAKE,
          severity: EventSeverity.HIGH,
          metaJson: { source: 'test' },
        },
        {
          fleetId,
          bikeId,
          deviceId,
          ts: new Date('2026-03-06T11:20:00.000Z'),
          type: EventType.SOS,
          severity: EventSeverity.HIGH,
          metaJson: { source: 'test' },
        },
      ],
    });
  };

  // Authenticates the seeded rider account and returns a bearer token.
  const loginAsRider = async (): Promise<string> => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        phone: riderPhone,
        password: riderPassword,
      })
      .expect(200);

    return (login.body as { accessToken: string }).accessToken;
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
    riderToken = await loginAsRider();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
  });

  it('allows rider login and returns only trips belonging to that rider', async () => {
    const response = await request(httpServer)
      .get('/rider/trips?page=1&pageSize=20')
      .set('Authorization', `Bearer ${riderToken}`)
      .expect(200);

    const body = response.body as {
      data: Array<{ id: string }>;
    };
    const tripIds = body.data.map((trip) => trip.id);

    expect(tripIds).toContain(ownTripId);
    expect(tripIds).not.toContain(otherRiderTripId);
  });

  it('creates SOS event and notification rows for emergency contacts', async () => {
    const startedAt = new Date();

    const response = await request(httpServer)
      .post('/rider/sos')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({
        message: 'Rider requested urgent assistance',
        lat: -1.944,
        lng: 30.061,
      })
      .expect(201);

    const body = response.body as {
      type: string;
      notifiedContacts: number;
      event: {
        id: string;
        fleetId: string;
        type: string;
        severity: string;
      };
    };

    expect(body.type).toBe('SOS');
    expect(body.event.type).toBe('SOS');
    expect(body.event.severity).toBe('HIGH');
    expect(body.event.fleetId).toBe(fleetId);
    expect(body.notifiedContacts).toBeGreaterThanOrEqual(1);

    const savedEvent = await prisma.event.findUnique({
      where: {
        id: BigInt(body.event.id),
      },
    });
    expect(savedEvent?.type).toBe(EventType.SOS);
    expect(savedEvent?.severity).toBe(EventSeverity.HIGH);

    const notifications = await prisma.notification.findMany({
      where: {
        fleetId,
        type: NotificationType.SOS_ALERT,
        to: emergencyPhone,
        createdAt: {
          gte: startedAt,
        },
      },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    const sosAudit = await prisma.auditLog.findFirst({
      where: {
        fleetId,
        actorUserId: riderUserId,
        actionType: 'SOS_TRIGGERED',
        createdAt: {
          gte: startedAt,
        },
      },
    });
    expect(sosAudit).not.toBeNull();
  });

  it('returns rider trip detail with event counts and score breakdown', async () => {
    const response = await request(httpServer)
      .get(`/rider/trips/${ownTripId}`)
      .set('Authorization', `Bearer ${riderToken}`)
      .expect(200);

    const body = response.body as {
      id: string;
      eventCounts: {
        OVERSPEED: number;
        HARSH_BRAKE: number;
      };
      scoreBreakdown: {
        penalties: {
          total: number;
        };
      };
    };

    expect(body.id).toBe(ownTripId);
    expect(body.eventCounts.OVERSPEED).toBeGreaterThanOrEqual(1);
    expect(body.eventCounts.HARSH_BRAKE).toBeGreaterThanOrEqual(1);
    expect(body.scoreBreakdown.penalties.total).toBeGreaterThan(0);
  });

  it('returns recent rider events for assigned bike', async () => {
    const response = await request(httpServer)
      .get('/rider/events?limit=5')
      .set('Authorization', `Bearer ${riderToken}`)
      .expect(200);

    const body = response.body as Array<{
      id: string;
      bikeId: string | null;
    }>;

    expect(body.length).toBeGreaterThan(0);
    for (const event of body) {
      expect(event.id).toMatch(/^\d+$/);
      expect(event.bikeId).toBe(bikeId);
    }
  });
});
