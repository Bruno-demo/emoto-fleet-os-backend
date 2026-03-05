import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth, RBAC, and Provisioning (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let token = '';
  let fleetBikeId = '';
  let foreignDeviceId = '';
  let foreignBikeId = '';
  let provisionedDeviceId = '';
  let provisionedDeviceSecret = '';
  let provisionedDeviceUid = '';

  // Seeds deterministic auth and fleet data required for login/RBAC assertions.
  const seedFixtures = async (): Promise<void> => {
    const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 10);
    const dispatcherPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

    const fleet = await prisma.fleet.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Fleet',
        type: 'DELIVERY',
      },
    });

    await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId: fleet.id,
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
        fleetId: fleet.id,
        role: 'ADMIN',
        email: 'admin@demo.emoto',
        phone: '+250700000001',
        passwordHash: adminPasswordHash,
        status: 'ACTIVE',
      },
    });

    await prisma.bike.upsert({
      where: {
        fleetId_label: {
          fleetId: fleet.id,
          label: 'Bike-001',
        },
      },
      update: {
        model: 'eMoto-X',
        status: 'ACTIVE',
      },
      create: {
        fleetId: fleet.id,
        label: 'Bike-001',
        model: 'eMoto-X',
        status: 'ACTIVE',
      },
    });

    await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId: fleet.id,
          email: 'dispatcher@demo.emoto',
        },
      },
      update: {
        role: 'DISPATCHER',
        passwordHash: dispatcherPasswordHash,
        status: 'ACTIVE',
      },
      create: {
        fleetId: fleet.id,
        role: 'DISPATCHER',
        email: 'dispatcher@demo.emoto',
        passwordHash: dispatcherPasswordHash,
        status: 'ACTIVE',
      },
    });

    const foreignFleet = await prisma.fleet.upsert({
      where: { id: '00000000-0000-0000-0000-000000000099' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000099',
        name: 'Foreign Fleet',
        type: 'COOP',
      },
    });

    const foreignBike = await prisma.bike.upsert({
      where: {
        fleetId_label: {
          fleetId: foreignFleet.id,
          label: 'Bike-FOREIGN',
        },
      },
      update: {},
      create: {
        fleetId: foreignFleet.id,
        label: 'Bike-FOREIGN',
        model: 'OtherModel',
        status: 'ACTIVE',
      },
    });

    foreignBikeId = foreignBike.id;

    const foreignDevice = await prisma.device.upsert({
      where: { deviceUid: 'DEV-FOREIGN-0001' },
      update: {
        fleetId: foreignFleet.id,
        bikeId: foreignBike.id,
        secretHash: 'seeded-hash-foreign',
        status: 'ACTIVE',
      },
      create: {
        fleetId: foreignFleet.id,
        deviceUid: 'DEV-FOREIGN-0001',
        bikeId: foreignBike.id,
        secretHash: 'seeded-hash-foreign',
        status: 'ACTIVE',
      },
    });

    foreignDeviceId = foreignDevice.id;

    const ownBike = await prisma.bike.upsert({
      where: {
        fleetId_label: {
          fleetId: fleet.id,
          label: 'Bike-ASSIGN-TARGET',
        },
      },
      update: {
        status: 'ACTIVE',
      },
      create: {
        fleetId: fleet.id,
        label: 'Bike-ASSIGN-TARGET',
        status: 'ACTIVE',
      },
    });

    fleetBikeId = ownBike.id;
  };

  // Computes the persisted hash format used for device secrets.
  const hashDeviceSecret = (secret: string): string => {
    return createHash('sha256').update(secret).digest('hex');
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
    await app.close();
    await prisma.$disconnect();
  });

  it('logs in with email+password and returns an access token', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        email: 'admin@demo.emoto',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const loginBody = login.body as { accessToken: string };
    expect(loginBody.accessToken).toBeDefined();
    token = loginBody.accessToken;
  });

  it('supports phone+password login and allows GET /me', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        phone: '+250700000001',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const loginBody = login.body as { accessToken: string };

    const me = await request(httpServer)
      .get('/me')
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .expect(200);

    const meBody = me.body as { email: string; role: string; fleetId: string };
    expect(meBody.email).toBe('admin@demo.emoto');
    expect(meBody.role).toBe('ADMIN');
    expect(meBody.fleetId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('blocks cross-fleet bike access', async () => {
    await request(httpServer)
      .get(`/bikes/${foreignBikeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('blocks cross-fleet device access', async () => {
    await request(httpServer)
      .get(`/devices/${foreignDeviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('creates a device and returns one-time secret without exposing secretHash', async () => {
    const deviceUid = `DEV-E2E-${Date.now()}`;
    const response = await request(httpServer)
      .post('/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceUid,
        imei: `86321104${Date.now().toString().slice(-8)}`,
        fwVersion: 'v1.2.3',
      })
      .expect(201);

    const body = response.body as {
      device: {
        id: string;
        fleetId: string;
        deviceUid: string;
        bikeId: string | null;
        secretHash?: string;
      };
      deviceSecret: string;
    };

    expect(body.device.id).toBeDefined();
    expect(body.device.deviceUid).toBe(deviceUid);
    expect(body.device.secretHash).toBeUndefined();
    expect(body.deviceSecret).toBeDefined();

    provisionedDeviceId = body.device.id;
    provisionedDeviceSecret = body.deviceSecret;
    provisionedDeviceUid = body.device.deviceUid;

    const persisted = await prisma.device.findUnique({
      where: { id: provisionedDeviceId },
      select: {
        secretHash: true,
      },
    });

    expect(persisted?.secretHash).toBe(
      hashDeviceSecret(provisionedDeviceSecret),
    );
  });

  it('lists devices for the fleet and never returns secretHash', async () => {
    const response = await request(httpServer)
      .get('/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = response.body as Array<{
      id: string;
      deviceUid: string;
      secretHash?: string;
    }>;
    const created = body.find((item) => item.id === provisionedDeviceId);

    expect(created).toBeDefined();
    expect(created?.deviceUid).toBe(provisionedDeviceUid);
    expect(created?.secretHash).toBeUndefined();
  });

  it('assigns a device to a bike in the same fleet', async () => {
    const response = await request(httpServer)
      .post(`/devices/${provisionedDeviceId}/assign-bike`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bikeId: fleetBikeId })
      .expect(201);

    const body = response.body as {
      id: string;
      bikeId: string | null;
      bike: { id: string; label: string } | null;
      secretHash?: string;
    };

    expect(body.id).toBe(provisionedDeviceId);
    expect(body.bikeId).toBe(fleetBikeId);
    expect(body.bike?.id).toBe(fleetBikeId);
    expect(body.secretHash).toBeUndefined();
  });

  it('rotates device secret and invalidates previous hash', async () => {
    const before = await prisma.device.findUnique({
      where: { id: provisionedDeviceId },
      select: { secretHash: true },
    });
    expect(before?.secretHash).toBe(hashDeviceSecret(provisionedDeviceSecret));

    const response = await request(httpServer)
      .post(`/devices/${provisionedDeviceId}/rotate-secret`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    const body = response.body as {
      deviceId: string;
      deviceUid: string;
      deviceSecret: string;
      secretHash?: string;
    };

    expect(body.deviceId).toBe(provisionedDeviceId);
    expect(body.deviceUid).toBe(provisionedDeviceUid);
    expect(body.deviceSecret).toBeDefined();
    expect(body.deviceSecret).not.toBe(provisionedDeviceSecret);
    expect(body.secretHash).toBeUndefined();

    const after = await prisma.device.findUnique({
      where: { id: provisionedDeviceId },
      select: { secretHash: true },
    });

    expect(after?.secretHash).toBe(hashDeviceSecret(body.deviceSecret));
    expect(after?.secretHash).not.toBe(before?.secretHash);
  });

  it('forbids dispatcher from provisioning device secrets', async () => {
    const dispatcherLogin = await request(httpServer)
      .post('/auth/login')
      .send({
        email: 'dispatcher@demo.emoto',
        password: 'ChangeMe123!',
      })
      .expect(200);

    const dispatcherToken = (dispatcherLogin.body as { accessToken: string })
      .accessToken;

    await request(httpServer)
      .post('/devices')
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        deviceUid: `DEV-FORBIDDEN-${Date.now()}`,
      })
      .expect(403);
  });
});
