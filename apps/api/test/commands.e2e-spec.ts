import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  encryptDeviceSecret,
  hashDeviceSecret,
} from '../src/crypto/device-secret.crypto';
import { RedisService } from '../src/redis/redis.service';

describe('Device Commands API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redisService: RedisService;
  let httpServer: Parameters<typeof request>[0];
  let token = '';
  let fleetId = '';
  let bikeId = '';
  let deviceId = '';
  const runId = randomUUID().replace(/-/g, '');
  const adminEmail = `admin.commands.${runId}@demo.emoto`;
  const adminPhone = `+2507${runId.slice(0, 8)}`;
  const bikeLabel = `Bike-CMD-${runId.slice(0, 6)}`;
  const deviceUid = `DEV-CMD-${runId.slice(0, 8)}`;

  // Seeds deterministic admin + bike + device data for command endpoint assertions.
  const seedFixtures = async (): Promise<void> => {
    const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

    const fleet = await prisma.fleet.create({
      data: {
        name: `Demo Fleet Commands ${runId.slice(0, 6)}`,
        type: 'DELIVERY',
        plan: 'PREMIUM',
        subscriptionStatus: 'ACTIVE',
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

    const masterKey =
      process.env.DEVICE_SECRET_MASTER_KEY ??
      'change_me_device_secret_master_key_32chars';
    const seedSecret = 'device-secret-cmd-001';

    const device = await prisma.device.create({
      data: {
        fleetId,
        bikeId,
        deviceUid,
        status: 'ACTIVE',
        secretHash: hashDeviceSecret(seedSecret),
        secretEncrypted: encryptDeviceSecret(seedSecret, masterKey),
      },
    });
    deviceId = device.id;
  };

  // Writes fleet bike live state projection into Redis for lock safety checks.
  const setLiveState = async (
    speedKph: number,
    tsOffsetMs: number,
  ): Promise<void> => {
    const ts = new Date(Date.now() - tsOffsetMs).toISOString();
    const key = `live:fleet:${fleetId}:bike:${bikeId}`;

    await redisService.set(
      key,
      JSON.stringify({
        fleetId,
        bikeId,
        deviceId,
        deviceUid,
        ts,
        lat: -1.944,
        lng: 30.061,
        speedKph,
      }),
      600,
    );
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
    redisService = app.get(RedisService);

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

  it('rejects lock when bike is moving', async () => {
    await setLiveState(18.6, 5_000);

    await request(httpServer)
      .post(`/commands/lock?bikeId=${bikeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it('accepts lock when bike is stationary for at least 15 seconds', async () => {
    await setLiveState(0, 20_000);

    const response = await request(httpServer)
      .post(`/commands/lock?bikeId=${bikeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    const body = response.body as {
      id: string;
      bikeId: string;
      type: string;
      status: string;
      nonce: string;
      expiresAt: string;
    };

    expect(body.id).toBeDefined();
    expect(body.bikeId).toBe(bikeId);
    expect(body.type).toBe('LOCK');
    expect(['SENT', 'FAILED']).toContain(body.status);
    expect(body.nonce).toBeDefined();
    expect(body.expiresAt).toBeDefined();

    const command = await prisma.deviceCommand.findUnique({
      where: { id: body.id },
    });

    expect(command).not.toBeNull();
    expect(command?.bikeId).toBe(bikeId);
    expect(command?.type).toBe('LOCK');
    expect(command?.status).toBe(body.status);
  });
});
