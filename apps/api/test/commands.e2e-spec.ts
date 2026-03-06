import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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

  // Seeds deterministic admin + bike + device data for command endpoint assertions.
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
          label: 'Bike-CMD-001',
        },
      },
      update: {
        status: 'ACTIVE',
      },
      create: {
        fleetId,
        label: 'Bike-CMD-001',
        status: 'ACTIVE',
      },
    });
    bikeId = bike.id;

    const masterKey =
      process.env.DEVICE_SECRET_MASTER_KEY ??
      'change_me_device_secret_master_key_32chars';
    const seedSecret = 'device-secret-cmd-001';

    await prisma.device.upsert({
      where: { deviceUid: 'DEV-CMD-0001' },
      update: {
        fleetId,
        bikeId,
        status: 'ACTIVE',
        secretHash: hashDeviceSecret(seedSecret),
        secretEncrypted: encryptDeviceSecret(seedSecret, masterKey),
      },
      create: {
        fleetId,
        bikeId,
        deviceUid: 'DEV-CMD-0001',
        status: 'ACTIVE',
        secretHash: hashDeviceSecret(seedSecret),
        secretEncrypted: encryptDeviceSecret(seedSecret, masterKey),
      },
    });
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
        deviceId: '00000000-0000-0000-0000-000000000010',
        deviceUid: 'DEV-CMD-0001',
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
      email: 'admin@demo.emoto',
      password: 'ChangeMe123!',
    });

    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
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
