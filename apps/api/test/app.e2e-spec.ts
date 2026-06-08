import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth, RBAC, and Provisioning (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let token = '';
  let fleetId = '';
  let fleetBikeId = '';
  let foreignDeviceId = '';
  let foreignBikeId = '';
  let provisionedDeviceId = '';
  let provisionedDeviceSecret = '';
  let provisionedDeviceUid = '';
  let insurerSameFleetToken = '';
  let assignedBikeId = '';
  const runId = randomUUID().replace(/-/g, '');
  const primaryFleetSeedId = randomUUID();
  const foreignFleetSeedId = randomUUID();
  const adminEmail = `admin.app.${runId}@demo.emoto`;
  const dispatcherEmail = `dispatcher.app.${runId}@demo.emoto`;
  const adminPhone = `+2507${runId.slice(0, 8)}`;

  // Seeds deterministic auth and fleet data required for login/RBAC assertions.
  const seedFixtures = async (): Promise<void> => {
    const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 10);
    const dispatcherPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

    const fleet = await prisma.fleet.upsert({
      where: { id: primaryFleetSeedId },
      update: {
        plan: 'PREMIUM',
        subscriptionStatus: 'ACTIVE',
      },
      create: {
        id: primaryFleetSeedId,
        name: 'Demo Fleet',
        type: 'DELIVERY',
        plan: 'PREMIUM',
        subscriptionStatus: 'ACTIVE',
      },
    });
    fleetId = fleet.id;

    await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId: fleet.id,
          email: adminEmail,
        },
      },
      update: {
        role: 'ADMIN',
        phone: adminPhone,
        passwordHash: adminPasswordHash,
        status: 'ACTIVE',
      },
      create: {
        fleetId: fleet.id,
        role: 'ADMIN',
        email: adminEmail,
        phone: adminPhone,
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
          email: dispatcherEmail,
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
        email: dispatcherEmail,
        passwordHash: dispatcherPasswordHash,
        status: 'ACTIVE',
      },
    });

    const foreignFleet = await prisma.fleet.upsert({
      where: { id: foreignFleetSeedId },
      update: {
        plan: 'PREMIUM',
        subscriptionStatus: 'ACTIVE',
      },
      create: {
        id: foreignFleetSeedId,
        name: 'Foreign Fleet',
        type: 'COOP',
        plan: 'PREMIUM',
        subscriptionStatus: 'ACTIVE',
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

    const insurerSameFleetEmail = `insurer.same.${runId}@demo.emoto`;
    const insurerSameFleetPhone = `+25078${runId.slice(0, 7)}`;
    const insurerPasswordHash = await bcrypt.hash('ChangeMe123!', 10);

    const insurerSameFleetSeedId = randomUUID();
    const insurerSameFleet = await prisma.fleet.upsert({
      where: { id: insurerSameFleetSeedId },
      update: {
        plan: 'INSURANCE',
        insurerName: 'Sanlam',
        subscriptionStatus: 'ACTIVE',
      },
      create: {
        id: insurerSameFleetSeedId,
        name: 'Sanlam Insurance',
        type: 'PERSONAL',
        plan: 'INSURANCE',
        insurerName: 'Sanlam',
        subscriptionStatus: 'ACTIVE',
      },
    });

    await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId: insurerSameFleet.id,
          email: insurerSameFleetEmail,
        },
      },
      update: {
        role: 'INSURER',
        phone: insurerSameFleetPhone,
        passwordHash: insurerPasswordHash,
        status: 'ACTIVE',
      },
      create: {
        fleetId: insurerSameFleet.id,
        role: 'INSURER',
        email: insurerSameFleetEmail,
        phone: insurerSameFleetPhone,
        passwordHash: insurerPasswordHash,
        status: 'ACTIVE',
      },
    });

    const insurerForeignFleetEmail = `insurer.foreign.${runId}@demo.emoto`;
    const insurerForeignFleetSeedId = randomUUID();
    const insurerForeignFleet = await prisma.fleet.upsert({
      where: { id: insurerForeignFleetSeedId },
      update: {
        plan: 'INSURANCE',
        insurerName: 'Radiant',
        subscriptionStatus: 'ACTIVE',
      },
      create: {
        id: insurerForeignFleetSeedId,
        name: 'Radiant Insurance',
        type: 'PERSONAL',
        plan: 'INSURANCE',
        insurerName: 'Radiant',
        subscriptionStatus: 'ACTIVE',
      },
    });

    await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId: insurerForeignFleet.id,
          email: insurerForeignFleetEmail,
        },
      },
      update: {
        role: 'INSURER',
        passwordHash: insurerPasswordHash,
        status: 'ACTIVE',
      },
      create: {
        fleetId: insurerForeignFleet.id,
        role: 'INSURER',
        email: insurerForeignFleetEmail,
        passwordHash: insurerPasswordHash,
        status: 'ACTIVE',
      },
    });

    const riderSameFleetEmail = `rider.same.${runId}@demo.emoto`;
    await prisma.user.upsert({
      where: {
        fleetId_email: {
          fleetId: fleet.id,
          email: riderSameFleetEmail,
        },
      },
      update: {
        role: 'RIDER',
        passwordHash: insurerPasswordHash,
        status: 'ACTIVE',
      },
      create: {
        fleetId: fleet.id,
        role: 'RIDER',
        email: riderSameFleetEmail,
        passwordHash: insurerPasswordHash,
        status: 'ACTIVE',
      },
    });

    const assignedBike = await prisma.bike.upsert({
      where: {
        fleetId_label: {
          fleetId: fleet.id,
          label: 'Bike-INSURER-ASSIGNED',
        },
      },
      update: {
        insurerName: 'Sanlam',
        status: 'ACTIVE',
      },
      create: {
        fleetId: fleet.id,
        label: 'Bike-INSURER-ASSIGNED',
        insurerName: 'Sanlam',
        status: 'ACTIVE',
      },
    });
    assignedBikeId = assignedBike.id;
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
        email: adminEmail,
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
        phone: adminPhone,
        password: 'ChangeMe123!',
      })
      .expect(200);

    const loginBody = login.body as { accessToken: string };

    const me = await request(httpServer)
      .get('/me')
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .expect(200);

    const meBody = me.body as { email: string; role: string; fleetId: string };
    expect(meBody.email).toBe(adminEmail);
    expect(meBody.role).toBe('ADMIN');
    expect(meBody.fleetId).toBe(fleetId);
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

    const body = response.body as {
      data: Array<{
        id: string;
        deviceUid: string;
        secretHash?: string;
      }>;
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    const created = body.data.find((item) => item.id === provisionedDeviceId);

    expect(created).toBeDefined();
    expect(created?.deviceUid).toBe(provisionedDeviceUid);
    expect(created?.secretHash).toBeUndefined();
    expect(body.total).toBeGreaterThan(0);
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
        email: dispatcherEmail,
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

  it('logs in the insurer user', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        email: `insurer.same.${runId}@demo.emoto`,
        password: 'ChangeMe123!',
      })
      .expect(200);

    insurerSameFleetToken = (login.body as { accessToken: string }).accessToken;
  });

  describe('Insurer-Bike Assignment Validation and Access Restrictions', () => {
    it('allows assigning insurerName to a bike', async () => {
      const response = await request(httpServer)
        .patch(`/bikes/${fleetBikeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ insurerName: 'Sanlam' })
        .expect(200);

      const body = response.body as { insurerName: string };
      expect(body.insurerName).toBe('Sanlam');
    });

    it('allows INSURER to fetch assigned bikes list', async () => {
      const response = await request(httpServer)
        .get('/bikes')
        .set('Authorization', `Bearer ${insurerSameFleetToken}`)
        .expect(200);

      const body = response.body as { data: Array<{ id: string }> };
      const data = body.data;
      const bikeIds = data.map((b) => b.id);
      expect(bikeIds).toContain(assignedBikeId);
      expect(bikeIds).toContain(fleetBikeId);
    });

    it('allows INSURER to fetch details of assigned bike', async () => {
      await request(httpServer)
        .get(`/bikes/${assignedBikeId}`)
        .set('Authorization', `Bearer ${insurerSameFleetToken}`)
        .expect(200);
    });

    it('blocks INSURER from accessing details of bike insured by another company', async () => {
      const otherInsurerBike = await prisma.bike.create({
        data: {
          fleetId,
          label: `Bike-OTHER-INSURER-${Date.now()}`,
          insurerName: 'Radiant',
          status: 'ACTIVE',
        },
      });

      await request(httpServer)
        .get(`/bikes/${otherInsurerBike.id}`)
        .set('Authorization', `Bearer ${insurerSameFleetToken}`)
        .expect(403);
    });

    it('allows ADMIN to query audit-logs with pagination and actionType', async () => {
      const response = await request(httpServer)
        .get(
          '/audit-logs?page=1&pageSize=25&actionType=BIKE_ASSIGNMENT_CHANGED',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as { data: unknown };
      expect(body.data).toBeDefined();
    });
  });

  describe('User Registration with fullName (e2e)', () => {
    it('creates a RiderProfile with fullName during registerFleet (admin signup)', async () => {
      const email = `admin.register.test.${runId}@demo.emoto`;

      // 1. Send OTP
      const otpRes = await request(httpServer)
        .post('/auth/send-otp')
        .send({ email, reason: 'register' })
        .expect(200);

      const otp = (otpRes.body as { otp: string }).otp;
      expect(otp).toBeDefined();

      // 2. Verify OTP
      await request(httpServer)
        .post('/auth/verify-otp')
        .send({ email, reason: 'register', otp })
        .expect(200);

      // 3. Register Fleet
      const regRes = await request(httpServer)
        .post('/auth/register-fleet')
        .send({
          fleetName: 'E2E Registration Fleet',
          bikeRange: 80,
          email,
          phone: `+25081${runId.slice(0, 7)}`,
          password: 'ChangeMe123!',
          plan: 'DEMO',
          fullName: 'E2E Admin Full Name',
        })
        .expect(201);

      const user = regRes.body as { id: string; fleetId: string };
      expect(user.id).toBeDefined();

      // 4. Verify RiderProfile was created
      const profile = await prisma.riderProfile.findUnique({
        where: { userId: user.id },
      });
      expect(profile).toBeDefined();
      expect(profile?.fullName).toBe('E2E Admin Full Name');

      // 5. Temporarily elevate the new user to HQ Admin by changing their fleet name to 'E-Moto HQ' in the DB
      await prisma.fleet.update({
        where: { id: user.fleetId },
        data: { name: 'E-Moto HQ' },
      });

      const loginRes = await request(httpServer)
        .post('/auth/login')
        .send({
          email,
          password: 'ChangeMe123!',
        })
        .expect(200);

      const hqToken = (loginRes.body as { accessToken: string }).accessToken;

      // 6. Permanently delete the fleet (HQ admin override)
      await request(httpServer)
        .delete(`/hq/fleets/${user.fleetId}/permanent`)
        .set('Authorization', `Bearer ${hqToken}`)
        .expect(200);

      // 7. Verify the fleet and cascaded user are completely deleted
      const checkFleet = await prisma.fleet.findUnique({
        where: { id: user.fleetId },
      });
      expect(checkFleet).toBeNull();

      const checkUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(checkUser).toBeNull();
    });

    it('creates a RiderProfile with fullName during register (admin-mode user creation)', async () => {
      const email = `dispatcher.register.test.${runId}@demo.emoto`;

      // 1. Send OTP
      const otpRes = await request(httpServer)
        .post('/auth/send-otp')
        .send({ email, reason: 'register' })
        .expect(200);

      const otp = (otpRes.body as { otp: string }).otp;
      expect(otp).toBeDefined();

      // 2. Verify OTP
      await request(httpServer)
        .post('/auth/verify-otp')
        .send({ email, reason: 'register', otp })
        .expect(200);

      // 3. Register User (admin mode)
      const regRes = await request(httpServer)
        .post('/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email,
          phone: `+25082${runId.slice(0, 7)}`,
          password: 'ChangeMe123!',
          role: 'DISPATCHER',
          fullName: 'E2E Dispatcher Full Name',
        })
        .expect(201);

      const user = regRes.body as { id: string };
      expect(user.id).toBeDefined();

      // 4. Verify RiderProfile was created
      const profile = await prisma.riderProfile.findUnique({
        where: { userId: user.id },
      });
      expect(profile).toBeDefined();
      expect(profile?.fullName).toBe('E2E Dispatcher Full Name');
    });

    it('creates a RiderProfile with fullName during register-invite (invite redemption)', async () => {
      const email = `invite.register.test.${runId}@demo.emoto`;

      // 1. Create Invite
      const inviteRes = await request(httpServer)
        .post('/auth/invites')
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: 'DISPATCHER',
          email,
        })
        .expect(201);

      const inviteToken = (inviteRes.body as { token: string }).token;
      expect(inviteToken).toBeDefined();

      // 2. Send OTP
      const otpRes = await request(httpServer)
        .post('/auth/send-otp')
        .send({ email, reason: 'register' })
        .expect(200);

      const otp = (otpRes.body as { otp: string }).otp;
      expect(otp).toBeDefined();

      // 3. Verify OTP
      await request(httpServer)
        .post('/auth/verify-otp')
        .send({ email, reason: 'register', otp })
        .expect(200);

      // 4. Redeem Invite
      const regRes = await request(httpServer)
        .post('/auth/register-invite')
        .send({
          token: inviteToken,
          email,
          phone: `+25083${runId.slice(0, 7)}`,
          password: 'ChangeMe123!',
          fullName: 'E2E Invite User Full Name',
        })
        .expect(201);

      const user = regRes.body as { id: string };
      expect(user.id).toBeDefined();

      // 5. Verify RiderProfile was created
      const profile = await prisma.riderProfile.findUnique({
        where: { userId: user.id },
      });
      expect(profile).toBeDefined();
      expect(profile?.fullName).toBe('E2E Invite User Full Name');
    });
  });

  describe('HQ Pending Setups and count (e2e)', () => {
    const originalFleetName = 'Demo Fleet';

    beforeAll(async () => {
      // Elevate the seeded fleet to 'E-Moto HQ' to pass HqGuard checks
      await prisma.fleet.update({
        where: { id: fleetId },
        data: { name: 'E-Moto HQ' },
      });
    });

    afterAll(async () => {
      // Revert the fleet name back to original
      await prisma.fleet.update({
        where: { id: fleetId },
        data: { name: originalFleetName },
      });
    });

    it('returns the correct pending setups count', async () => {
      const res = await request(httpServer)
        .get('/hq/pending-setups/count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as { pendingUsers: number; pendingBikes: number };
      expect(body).toHaveProperty('pendingUsers');
      expect(body).toHaveProperty('pendingBikes');
      expect(typeof body.pendingUsers).toBe('number');
      expect(typeof body.pendingBikes).toBe('number');
    });

    it('returns the list of pending bikes', async () => {
      const res = await request(httpServer)
        .get('/hq/bikes/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as Array<{
        id: string;
        label: string;
        fleet: unknown;
      }>;
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('id');
        expect(body[0]).toHaveProperty('label');
        expect(body[0]).toHaveProperty('fleet');
      }
    });
  });
});
