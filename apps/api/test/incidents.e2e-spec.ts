import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  IncidentStatus,
  NotificationStatus,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EventsService } from '../src/events/events.service';
import { DevicesService } from '../src/devices/devices.service';

describe('Incidents and Notification Outbox (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let eventsService: EventsService;
  let devicesService: DevicesService;
  let token = '';
  let fleetId = '';
  let bikeId = '';
  let deviceId = '';
  let contactPhone = '';
  const runId = randomUUID().replace(/-/g, '');
  const adminEmail = `admin.incidents.${runId}@demo.emoto`;
  const adminPhone = `+2507${runId.slice(0, 8)}`;
  const bikeLabel = `Bike-INCIDENT-${runId.slice(0, 6)}`;
  const deviceUid = `DEV-INCIDENT-${runId.slice(0, 8)}`;

  // Seeds deterministic fleet data required for crash incident workflow tests.
  const seedFixtures = async (): Promise<void> => {
    const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

    const fleet = await prisma.fleet.create({
      data: {
        name: `Demo Fleet Incidents ${runId.slice(0, 6)}`,
        type: 'DELIVERY',
      },
    });
    fleetId = fleet.id;

    await prisma.user.create({
      data: {
        fleetId,
        role: 'ADMIN',
        email: adminEmail,
        phone: adminPhone,
        passwordHash: adminPasswordHash,
        status: 'ACTIVE',
      },
    });

    const bike = await prisma.bike.create({
      data: {
        fleetId,
        label: bikeLabel,
        status: 'ACTIVE',
      },
    });
    bikeId = bike.id;

    const device = await prisma.device.create({
      data: {
        fleetId,
        bikeId,
        deviceUid,
        status: 'ACTIVE',
        secretHash: 'seeded-hash-incident',
      },
    });
    deviceId = device.id;

    contactPhone = `+250700${Date.now().toString().slice(-6)}`;
    await prisma.emergencyContact.create({
      data: {
        fleetId,
        name: 'Night Dispatch',
        phone: contactPhone,
        role: 'DISPATCH',
        active: true,
      },
    });
  };

  // Waits until a notification reaches SENT/FAILED terminal state or times out.
  const waitForNotificationTerminalStatus = async (
    notificationId: string,
  ): Promise<NotificationStatus> => {
    const timeoutMs = 12_000;
    const pollIntervalMs = 250;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { status: true },
      });
      if (
        notification?.status === NotificationStatus.SENT ||
        notification?.status === NotificationStatus.FAILED
      ) {
        return notification.status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Notification processing timed out');
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
    eventsService = app.get(EventsService);
    devicesService = app.get(DevicesService);

    const login = await request(httpServer).post('/auth/login').send({
      email: adminEmail,
      password: 'ChangeMe123!',
    });

    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
  });

  it('creates incident + notifications when a CRASH event is created', async () => {
    const testStartedAt = new Date();
    const event = await eventsService.createFleetEvent({
      fleetId,
      bikeId,
      deviceId,
      ts: new Date(),
      type: 'CRASH',
      severity: 'CRITICAL',
      metaJson: {
        source: 'incidents-e2e',
      },
    });

    const incident = await prisma.incident.findUnique({
      where: { eventId: BigInt(event.id) },
    });

    expect(incident).not.toBeNull();
    expect(incident?.status).toBe(IncidentStatus.OPEN);
    expect(incident?.fleetId).toBe(fleetId);
    expect(incident?.bikeId).toBe(bikeId);
    expect(incident?.deviceId).toBe(deviceId);

    const notifications = await prisma.notification.findMany({
      where: {
        fleetId,
        type: 'CRASH_ALERT',
        to: contactPhone,
        createdAt: {
          gte: testStartedAt,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(notifications.length).toBeGreaterThanOrEqual(1);

    const status = await waitForNotificationTerminalStatus(notifications[0].id);
    expect([NotificationStatus.SENT, NotificationStatus.FAILED]).toContain(
      status,
    );

    const incidentsResponse = await request(httpServer)
      .get('/incidents?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const incidentsPayload = incidentsResponse.body as {
      data: Array<{ id: string; eventId: string }>;
    };
    expect(
      incidentsPayload.data.some((item) => item.eventId === event.id),
    ).toBe(true);
  });

  it('triggers TRACKER_OFFLINE incident when a device has no data for 5+ hours', async () => {
    // 1. Update seeded device to have lastSeenAt set to 6 hours ago
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: sixHoursAgo,
      },
    });

    // 2. Invoke monitorOfflineDevices
    await devicesService.monitorOfflineDevices();

    // 3. Find created incident
    const offlineIncident = await prisma.incident.findFirst({
      where: {
        deviceId,
        status: IncidentStatus.OPEN,
        event: {
          type: 'TRACKER_OFFLINE',
        },
      },
      include: {
        event: true,
      },
    });

    expect(offlineIncident).not.toBeNull();
    expect(offlineIncident?.bikeId).toBe(bikeId);
    expect(offlineIncident?.event.type).toBe('TRACKER_OFFLINE');
    expect(offlineIncident?.event.severity).toBe('HIGH');

    // 4. Run it again and verify duplicate incident is NOT created
    const countBefore = await prisma.incident.count({
      where: {
        deviceId,
        event: {
          type: 'TRACKER_OFFLINE',
        },
      },
    });

    await devicesService.monitorOfflineDevices();

    const countAfter = await prisma.incident.count({
      where: {
        deviceId,
        event: {
          type: 'TRACKER_OFFLINE',
        },
      },
    });

    expect(countAfter).toBe(countBefore);
  });
});
