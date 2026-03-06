import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EventsService } from '../src/events/events.service';

describe('Realtime WebSocket Gateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let eventsService: EventsService;
  let baseUrl = '';
  let token = '';
  let fleetId = '';
  let bikeId = '';
  let deviceId = '';
  let socket: Socket | null = null;

  // Seeds deterministic fleet data required for websocket auth and event delivery.
  const seedFixtures = async (): Promise<void> => {
    const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

    const fleet = await prisma.fleet.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Fleet',
        type: 'DELIVERY',
      },
    });
    fleetId = fleet.id;

    await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId,
          email: 'admin@demo.emoto',
        },
      },
      update: {
        role: 'ADMIN',
        phone: '+250700000001',
        passwordHash: adminPasswordHash,
        status: 'ACTIVE',
      },
      create: {
        fleetId,
        role: 'ADMIN',
        email: 'admin@demo.emoto',
        phone: '+250700000001',
        passwordHash: adminPasswordHash,
        status: 'ACTIVE',
      },
    });

    const bike = await prisma.bike.upsert({
      where: {
        fleetId_label: {
          fleetId,
          label: 'Bike-WS-001',
        },
      },
      update: {
        status: 'ACTIVE',
      },
      create: {
        fleetId,
        label: 'Bike-WS-001',
        status: 'ACTIVE',
      },
    });
    bikeId = bike.id;

    const device = await prisma.device.upsert({
      where: { deviceUid: 'DEV-WS-0001' },
      update: {
        fleetId,
        bikeId,
        status: 'ACTIVE',
        secretHash: 'seeded-hash-ws',
      },
      create: {
        fleetId,
        bikeId,
        deviceUid: 'DEV-WS-0001',
        status: 'ACTIVE',
        secretHash: 'seeded-hash-ws',
      },
    });
    deviceId = device.id;
  };

  // Waits for socket connect and fails fast on connect errors/timeouts.
  const waitForSocketConnect = async (client: Socket): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket connect timeout'));
      }, 5_000);

      client.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      client.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  };

  // Waits for subscribe_live ack to confirm active room subscription.
  const subscribeLive = async (client: Socket): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('subscribe_live ack timeout'));
      }, 5_000);

      client.emit(
        'subscribe_live',
        {},
        (ack: { subscribed: boolean; fleetId: string }) => {
          clearTimeout(timeout);
          if (!ack?.subscribed || ack.fleetId !== fleetId) {
            reject(new Error('Unexpected subscribe_live ack'));
            return;
          }

          resolve();
        },
      );
    });
  };

  // Waits for one new_event payload pushed from server.
  const waitForNewEvent = async (
    client: Socket,
  ): Promise<Record<string, unknown>> => {
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('new_event timeout'));
      }, 5_000);

      client.once('new_event', (payload: Record<string, unknown>) => {
        clearTimeout(timeout);
        resolve(payload);
      });
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
    await app.listen(0);

    const nodeHttpServer = app.getHttpServer() as HttpServer;
    const address = nodeHttpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    httpServer = nodeHttpServer as unknown as Parameters<typeof request>[0];
    eventsService = app.get(EventsService);

    const login = await request(httpServer).post('/auth/login').send({
      email: 'admin@demo.emoto',
      password: 'ChangeMe123!',
    });

    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    if (socket) {
      socket.disconnect();
    }

    await app.close();
    await prisma.$disconnect();
  });

  it('authenticates websocket clients and streams new_event to fleet room', async () => {
    socket = io(`${baseUrl}/fleet-events`, {
      auth: {
        token,
      },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    await waitForSocketConnect(socket);
    await subscribeLive(socket);

    const newEventPromise = waitForNewEvent(socket);

    await eventsService.createFleetEvent({
      fleetId,
      bikeId,
      deviceId,
      ts: new Date(),
      type: 'HARSH_BRAKE',
      severity: 'MEDIUM',
      metaJson: { source: 'e2e-websocket' },
    });

    const payload = await newEventPromise;

    expect(payload.type).toBe('HARSH_BRAKE');
    expect(payload.bikeId).toBe(bikeId);
    expect(payload.deviceId).toBe(deviceId);
    expect(payload).not.toHaveProperty('fleetId');
  });
});
