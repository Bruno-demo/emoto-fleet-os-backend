import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, DeliveryStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ensureTestSchemaSync } from './e2e-helpers';

describe('Deliveries API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];

  let adminToken = '';
  let rider1Token = '';
  let rider2Token = '';
  let coopToken = '';

  let fleetId = '';
  let rider1UserId = '';
  let rider2UserId = '';

  const runId = randomUUID().replace(/-/g, '');
  const adminEmail = `admin.deliveries.${runId}@demo.emoto`;
  const coopAdminEmail = `coop.deliveries.${runId}@demo.emoto`;
  const rider1Phone = `+2507${runId.slice(0, 8)}`;
  const rider2Phone = `+2506${runId.slice(0, 8)}`;
  const password = 'Password123!';

  const seedFixtures = async (): Promise<void> => {
    await ensureTestSchemaSync(prisma);
    const passwordHash = await bcrypt.hash(password, 10);

    const fleet = await prisma.fleet.create({
      data: {
        name: `Demo Delivery Fleet ${runId.slice(0, 6)}`,
        type: 'DELIVERY',
      },
    });
    fleetId = fleet.id;

    await prisma.user.create({
      data: {
        fleetId,
        role: 'ADMIN',
        email: adminEmail,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    const rider1 = await prisma.user.create({
      data: {
        fleetId,
        role: 'RIDER',
        phone: rider1Phone,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    rider1UserId = rider1.id;

    await prisma.riderProfile.create({
      data: {
        userId: rider1.id,
        fullName: 'Test Rider One',
      },
    });

    const rider2 = await prisma.user.create({
      data: {
        fleetId,
        role: 'RIDER',
        phone: rider2Phone,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    rider2UserId = rider2.id;

    await prisma.riderProfile.create({
      data: {
        userId: rider2.id,
        fullName: 'Test Rider Two',
      },
    });

    // Seed COOP fleet and COOP admin user
    const coopFleet = await prisma.fleet.create({
      data: {
        name: `Demo Coop Fleet ${runId.slice(0, 6)}`,
        type: 'COOP',
      },
    });

    await prisma.user.create({
      data: {
        fleetId: coopFleet.id,
        role: 'ADMIN',
        email: coopAdminEmail,
        passwordHash,
        status: 'ACTIVE',
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

    // Login Admin
    const adminLogin = await request(httpServer).post('/auth/login').send({
      email: adminEmail,
      password,
    });
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    // Login Rider 1
    const rider1Login = await request(httpServer).post('/auth/login').send({
      phone: rider1Phone,
      password,
    });
    rider1Token = (rider1Login.body as { accessToken: string }).accessToken;

    // Login Rider 2
    const rider2Login = await request(httpServer).post('/auth/login').send({
      phone: rider2Phone,
      password,
    });
    rider2Token = (rider2Login.body as { accessToken: string }).accessToken;

    // Login COOP Admin
    const coopLogin = await request(httpServer).post('/auth/login').send({
      email: coopAdminEmail,
      password,
    });
    coopToken = (coopLogin.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
  });

  describe('Delivery Workflows', () => {
    let deliveryId = '';

    it('creates a delivery order (POST /deliveries)', async () => {
      const response = await request(httpServer)
        .post('/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `ORD-${runId.slice(0, 8)}`,
          pickupAddress: 'Pickup Station A',
          pickupLat: -1.9441,
          pickupLng: 30.0899,
          dropoffAddress: 'Dropoff Station B',
          dropoffLat: -1.9398,
          dropoffLng: 30.0532,
          customerName: 'John Doe',
          customerPhone: '+250788888888',
          notes: 'Deliver before 5 PM',
        });

      expect(response.status).toBe(201);
      expect((response.body as { orderNumber: string }).orderNumber).toContain(
        'ORD-',
      );
      expect((response.body as { status: string }).status).toBe(
        DeliveryStatus.PENDING,
      );
      deliveryId = (response.body as { id: string }).id;
    });

    it('lists all deliveries for admin (GET /deliveries)', async () => {
      const response = await request(httpServer)
        .get('/deliveries')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect((response.body as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it('assigns a rider to the delivery (PUT /deliveries/:id/assign)', async () => {
      const response = await request(httpServer)
        .put(`/deliveries/${deliveryId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          riderId: rider1UserId,
        });

      expect(response.status).toBe(200);
      expect((response.body as { status: string }).status).toBe(
        DeliveryStatus.ASSIGNED,
      );
      expect((response.body as { riderId: string }).riderId).toBe(rider1UserId);
      expect(
        (response.body as { assignedAt: string }).assignedAt,
      ).toBeDefined();
    });

    it('fails to assign rider when delivery is terminal (simulate terminal transition)', async () => {
      // First let's test a valid update status to FAILED
      const failResponse = await request(httpServer)
        .put(`/deliveries/${deliveryId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: DeliveryStatus.FAILED,
          failureReason: 'Customer canceled',
        });
      expect(failResponse.status).toBe(200);

      // Try assigning again
      const assignResponse = await request(httpServer)
        .put(`/deliveries/${deliveryId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          riderId: rider2UserId,
        });
      expect(assignResponse.status).toBe(400); // Terminal state check
    });

    it('enforces status transition validations', async () => {
      // Create a new delivery to test full transitions
      const createResponse = await request(httpServer)
        .post('/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `ORD2-${runId.slice(0, 8)}`,
          pickupAddress: 'Pickup Station A',
          pickupLat: -1.9441,
          pickupLng: 30.0899,
          dropoffAddress: 'Dropoff Station B',
          dropoffLat: -1.9398,
          dropoffLng: 30.0532,
          customerName: 'Jane Doe',
          customerPhone: '+250788888889',
        });
      const newDeliveryId = (createResponse.body as { id: string }).id;

      // Assign to Rider 1
      await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ riderId: rider1UserId });

      // Invalid transition: ASSIGNED -> IN_TRANSIT (must be PICKED_UP first)
      const invalidResponse = await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: DeliveryStatus.IN_TRANSIT });
      expect(invalidResponse.status).toBe(400);

      // Valid: ASSIGNED -> PICKED_UP
      const pickedUpResponse = await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/status`)
        .set('Authorization', `Bearer ${rider1Token}`)
        .send({ status: DeliveryStatus.PICKED_UP });
      expect(pickedUpResponse.status).toBe(200);
      expect(
        (pickedUpResponse.body as { pickedUpAt: string }).pickedUpAt,
      ).toBeDefined();

      // Valid: PICKED_UP -> IN_TRANSIT
      const inTransitResponse = await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/status`)
        .set('Authorization', `Bearer ${rider1Token}`)
        .send({ status: DeliveryStatus.IN_TRANSIT });
      expect(inTransitResponse.status).toBe(200);
      expect(
        (inTransitResponse.body as { inTransitAt: string }).inTransitAt,
      ).toBeDefined();

      // Valid: IN_TRANSIT -> DELIVERED
      const deliveredResponse = await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/status`)
        .set('Authorization', `Bearer ${rider1Token}`)
        .send({
          status: DeliveryStatus.DELIVERED,
          proofPhotoUrl: 'http://test.image.url',
          proofSignature: 'signature-base64',
        });
      expect(deliveredResponse.status).toBe(200);
      expect(
        (deliveredResponse.body as { deliveredAt: string }).deliveredAt,
      ).toBeDefined();
      expect(
        (deliveredResponse.body as { proofPhotoUrl: string }).proofPhotoUrl,
      ).toBe('http://test.image.url');

      // Invalid: Try updating terminal DELIVERED status
      const terminalResponse = await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/status`)
        .set('Authorization', `Bearer ${rider1Token}`)
        .send({ status: DeliveryStatus.PENDING });
      expect(terminalResponse.status).toBe(400);
    });

    it('enforces RIDER security access constraints', async () => {
      // Create another delivery
      const createResponse = await request(httpServer)
        .post('/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `ORD3-${runId.slice(0, 8)}`,
          pickupAddress: 'Pickup Station A',
          pickupLat: -1.9441,
          pickupLng: 30.0899,
          dropoffAddress: 'Dropoff Station B',
          dropoffLat: -1.9398,
          dropoffLng: 30.0532,
          customerName: 'Bob Smith',
          customerPhone: '+250788888890',
        });
      const newDeliveryId = (createResponse.body as { id: string }).id;

      // Assign to Rider 1
      await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ riderId: rider1UserId });

      // Rider 2 tries to GET details of Rider 1's delivery -> Should return 404 (or 403, we return NotFoundException for privacy)
      const rider2GetResponse = await request(httpServer)
        .get(`/deliveries/${newDeliveryId}`)
        .set('Authorization', `Bearer ${rider2Token}`);
      expect(rider2GetResponse.status).toBe(404);

      // Rider 2 tries to update status of Rider 1's delivery -> Should return 400
      const rider2UpdateResponse = await request(httpServer)
        .put(`/deliveries/${newDeliveryId}/status`)
        .set('Authorization', `Bearer ${rider2Token}`)
        .send({ status: DeliveryStatus.PICKED_UP });
      expect(rider2UpdateResponse.status).toBe(400);

      // Rider 1 lists deliveries -> should only see their own assigned ones
      const rider1ListResponse = await request(httpServer)
        .get('/deliveries')
        .set('Authorization', `Bearer ${rider1Token}`);
      expect(rider1ListResponse.status).toBe(200);
      expect(Array.isArray(rider1ListResponse.body)).toBe(true);

      // Ensure all returned deliveries are assigned to Rider 1
      (rider1ListResponse.body as { riderId: string }[]).forEach((d) => {
        expect(d.riderId).toBe(rider1UserId);
      });
    });

    it('exposes public tracking without auth (GET /deliveries/public/:id/track)', async () => {
      const publicResponse = await request(httpServer).get(
        `/deliveries/public/${deliveryId}/track`,
      );

      const publicBody = publicResponse.body as {
        delivery?: { orderNumber: string; customerPhone?: string };
        riderName?: string;
      };
      expect(publicResponse.status).toBe(200);
      expect(publicBody.delivery).toBeDefined();
      expect(publicBody.delivery?.orderNumber).toBeDefined();
      expect(publicBody.delivery?.customerPhone).toBeUndefined(); // Should be redacted/not returned
      expect(publicBody.riderName).toBeDefined();
    });

    it('restricts delivery endpoints to DELIVERY fleets only (COOP returns 403)', async () => {
      const response = await request(httpServer)
        .post('/deliveries')
        .set('Authorization', `Bearer ${coopToken}`)
        .send({
          orderNumber: `ORD-COOP-${runId.slice(0, 8)}`,
          pickupAddress: 'Pickup Station A',
          pickupLat: -1.9441,
          pickupLng: 30.0899,
          dropoffAddress: 'Dropoff Station B',
          dropoffLat: -1.9398,
          dropoffLng: 30.0532,
          customerName: 'John Doe',
          customerPhone: '+250788888888',
        });
      expect(response.status).toBe(403);

      const listResponse = await request(httpServer)
        .get('/deliveries')
        .set('Authorization', `Bearer ${coopToken}`);
      expect(listResponse.status).toBe(403);
    });
  });
});
