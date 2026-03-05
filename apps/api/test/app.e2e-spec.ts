import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth and RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let token = '';
  let foreignBikeId = '';

  // Seeds deterministic auth and fleet data required for login/RBAC assertions.
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
});
