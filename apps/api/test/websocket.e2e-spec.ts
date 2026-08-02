import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Fleet, User, Bike, Device } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CommandsService } from '../src/commands/commands.service';
import { EventsService } from '../src/events/events.service';

describe('Realtime WebSocket Gateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let eventsService: EventsService;
  let commandsService: CommandsService;
  let baseUrl = '';
  let token = '';
  let fleetId = '';
  let bikeId = '';
  let deviceId = '';
  let adminUserId = '';
  const runId = randomUUID().replace(/-/g, '');
  const adminEmail = `admin.websocket.${runId}@demo.emoto`;
  const adminPhone = `+2507${runId.slice(0, 8)}`;
  const bikeLabel = `Bike-WS-${runId.slice(0, 6)}`;
  const deviceUid = `DEV-WS-${runId.slice(0, 8)}`;
  let socket: Socket | null = null;

  // Seeds deterministic fleet data required for websocket auth and event delivery.
  const seedFixtures = async (): Promise<void> => {
    const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

    const fleet: Fleet = await prisma.fleet.create({
      data: {
        name: `Demo Fleet Websocket ${runId.slice(0, 6)}`,
        type: 'DELIVERY',
      },
    });
    fleetId = fleet.id;

    const adminUser: User = await prisma.user.create({
      data: {
        fleetId,
        role: 'ADMIN',
        email: adminEmail,
        phone: adminPhone,
        passwordHash: adminPasswordHash,
        status: 'ACTIVE',
      },
    });
    adminUserId = adminUser.id;

    const bike: Bike = await prisma.bike.create({
      data: {
        fleetId,
        label: bikeLabel,
        status: 'ACTIVE',
      },
    });
    bikeId = bike.id;

    const device: Device = await prisma.device.create({
      data: {
        fleetId,
        bikeId,
        deviceUid,
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

  // Waits for one command_status payload pushed from server.
  const waitForCommandStatus = async (
    client: Socket,
  ): Promise<Record<string, unknown>> => {
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('command_status timeout'));
      }, 5_000);

      client.once('command_status', (payload: Record<string, unknown>) => {
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
    await app.listen(0);

    const nodeHttpServer = app.getHttpServer() as HttpServer;
    const address = nodeHttpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    httpServer = nodeHttpServer;
    eventsService = app.get<EventsService>(EventsService);
    commandsService = app.get<CommandsService>(CommandsService);

    const login = await request(httpServer).post('/auth/login').send({
      email: adminEmail,
      password: 'ChangeMe123!',
    });

    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    if (socket) {
      socket.disconnect();
    }

    if (app) {
      await app.close();
    }
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

    expect(payload['type'] as string).toBe('HARSH_BRAKE');
    expect(payload['bikeId'] as string).toBe(bikeId);
    expect(payload['deviceId'] as string).toBe(deviceId);
    expect(payload).not.toHaveProperty('fleetId');
  });

  it('streams command_status when command ack transitions to ACKED', async () => {
    if (!socket) {
      throw new Error('Socket client not initialized');
    }

    const command = await prisma.deviceCommand.create({
      data: {
        fleetId,
        deviceId,
        bikeId,
        type: 'LOCK',
        status: 'SENT',
        requestedByUserId: adminUserId,
        payloadJson: {},
        nonce: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const commandStatusPromise = waitForCommandStatus(socket);

    await commandsService.handleCommandAckFromDevice(
      { id: deviceId, fleetId, deviceUid },
      {
        commandId: command.id,
        status: 'ACKED',
        ts: new Date().toISOString(),
        nonce: randomUUID(),
        sig: 'a'.repeat(64),
      },
    );

    const payload = await commandStatusPromise;

    expect(payload['commandId'] as string).toBe(command.id);
    expect(payload['status'] as string).toBe('ACKED');
    expect(payload['bikeId'] as string).toBe(bikeId);
    expect(payload['deviceId'] as string).toBe(deviceId);

    const updated = await prisma.deviceCommand.findUnique({
      where: { id: command.id },
    });

    expect(updated?.status).toBe('ACKED');
  });
});
