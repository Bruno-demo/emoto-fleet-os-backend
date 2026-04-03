# emoto-fleet-os-backend

Monorepo scaffold for e-moto telematics using NestJS + TypeScript backend and Next.js dashboard.

## Stack
- NestJS API in `apps/api`
- API gateway in `apps/gateway`
- Next.js dashboard in `apps/dashboard`
- Expo React Native rider app in `apps/rider`
- Stream processor skeleton in `apps/stream-processor`
- PostgreSQL (TimescaleDB image) via Docker Compose
- Redis via Docker Compose
- EMQX MQTT broker via Docker Compose
- MinIO (S3-compatible) for incident evidence pack storage
- Insurer Partner API with OAuth2 client-credentials style auth

## Prerequisites
- Node.js 22+
- npm 11+
- Docker + Docker Compose

## Setup
1. Copy env values:
```bash
cp .env.example .env
```
2. Start backend stack in Docker:
```bash
docker compose up -d
```
This now starts:
- PostgreSQL
- Redis
- EMQX
- MinIO
- API on `http://localhost:3000`
- API gateway on `http://localhost:8080`
- Stream processor skeleton

If host port `3000` is already in use, set a different host mapping in `.env`:
```env
API_HOST_PORT=3004
NEXT_PUBLIC_API_URL=http://localhost:3004
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=1
```

To watch the API container logs, including the exposed port and URLs:
```bash
docker compose logs -f api
```
3. Run Prisma migration + seed:
```bash
npm run db:migrate
npm run db:seed
```
4. (Optional) Run the dedicated ingestion worker if you want MQTT processing outside the API:
```bash
npm run dev:worker
```
When running the worker locally, set `MQTT_DISABLED=true` for the API process to avoid double ingestion.

5. Start API on the host only if you are not using the Dockerized API:
```bash
npm run dev:api
```

API should run at `http://localhost:3000`.

6. (Optional) Start the gateway on the host if you are not using the Dockerized gateway:
```bash
npm run dev:gateway
```

7. (Optional) Start the stream processor on the host if you are not using the Dockerized service:
```bash
npm run dev:stream
```
The processor reads from `telemetry:stream` and emits to `telemetry:enriched`, `telemetry:score`, and `webhooks:outbox`.

8. Start dashboard:
```bash
npm run dev:dashboard
```

Dashboard runs at `http://localhost:3001`.

9. Start rider app (Expo):
```bash
npm run dev:rider
```

Rider app opens in Expo on `http://localhost:8082` (QR/dev-client workflow). Set `EXPO_PUBLIC_API_URL` in `apps/rider/.env` when using a physical device.

## Production Compose
1. Copy production env values:
```bash
cp .env.prod.example .env.prod
```
2. Build and start services:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

API runs at `http://localhost:3000`, gateway runs at `http://localhost:8080`, dashboard runs at `http://localhost:3001`.

## Monitoring (Prometheus + Grafana)
1. Start monitoring stack:
```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml --env-file .env.prod up -d
```
2. Access tools:
- Prometheus: `http://localhost:${PROMETHEUS_PORT:-9090}`
- Grafana: `http://localhost:${GRAFANA_PORT:-3005}` (default admin/admin)

The API metrics endpoint is available at `http://localhost:3000/metrics`.

## Healthcheck Status
Quickly verify the API and gateway health endpoints:
```bash
curl http://localhost:3000/health
curl http://localhost:8080/health
```

Check Docker container health at a glance:
```bash
docker compose ps
```

## Backups
The production compose includes a `backup` service that runs a daily Postgres dump into the `postgres_backups` volume.

Manual backup (one-off):
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm backup /bin/sh /backup/backup.sh
```

Restore from a dump:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm backup /bin/sh /backup/restore.sh /backups/your-backup.dump
```

## Troubleshooting
- If Docker shows `dockerDesktopLinuxEngine` pipe errors, wait for Docker Desktop to finish starting or restart Docker Desktop.
- If local Postgres is already installed, ensure `.env` has correct credentials and the target DB exists.
- If local Redis is unavailable, the API can still boot, but `/health` will report Redis as down until Redis is reachable.

## Health Endpoint
- `GET http://localhost:3000/health`
- Returns `200` with:
```json
{
  "status": "ok",
  "checks": {
    "db": "up",
    "redis": "up"
  }
}
```

## Live Fleet Endpoint
- `GET http://localhost:3000/live/bikes`
- Returns latest fleet bike states from Redis (requires JWT).
- Supports pagination: `?page=1&pageSize=20`.

## Zones and Events
- `POST /zones` (ADMIN only) to create a geofence zone.
- `GET /zones`, `GET /zones/:id`, `PATCH /zones/:id`, `DELETE /zones/:id` (ADMIN only).
- `GET /events?from&to&type` to fetch fleet-scoped events.
- `GET /bikes/:id/trips?from&to` to list bike trips.
- `GET /trips/:id` to fetch one trip details.
- `GET /reports/weekly` to fetch fleet weekly summary.
- `POST /bikes/:id/lock-actions` logs lock/unlock intent to audit log (lock integration pending).
- `POST /commands/lock?bikeId=...` requests device lock command with safety checks.
- `POST /commands/unlock?bikeId=...` requests device unlock command.
- `GET /incidents?from&to&status`, `GET /incidents/:id`
- `POST /incidents/:id/acknowledge`, `POST /incidents/:id/resolve`
- `GET /incidents/:id/evidence-pack` (returns short-lived presigned links)
- `CRUD /contacts` for emergency notification recipients
- `POST /partner/oauth/token` for partner access token issuance
- `GET /partner/fleets/:fleetId/weekly-summary`
- `GET /partner/bikes/:bikeId/trips`
- `GET /partner/incidents/:incidentId`
- `GET /partner/incidents/:incidentId/evidence-pack`
- `POST /partner/webhooks`

Pagination:
- List endpoints support `?page` and `?pageSize` (max 100).

Filtering:
- `/events`: `from`, `to`, `type`, `severity`, `bikeId`, `deviceId`
- `/bikes/:id/trips`: `from`, `to`, `minScore`, `maxScore`, `minDistanceKm`, `maxDistanceKm`

Zone types:
- `SLOW` (with `speedLimitKph`)
- `NO_GO`
- `PARK`

Rules engine emits:
- `OVERSPEED`
- `HARSH_BRAKE`, `HARSH_ACCEL`, `HARSH_CORNER`
- `CRASH`
- `THEFT_SUSPECTED`

WebSocket stream:
- Namespace: `/fleet-events`
- Client event: `subscribe_live`
- Server events: `bike_state`, `new_event`, `new_incident`, `command_status`
- Full contract: `docs/websocket.md`

## Auth Endpoints
- `POST /auth/login` with `email+password` or `phone+password`
- `POST /auth/register` (OWNER/ADMIN/limited roles, disabled by default via env)
- `POST /auth/invites` (OWNER/ADMIN only, returns a one-time invite token)
- `POST /auth/register-invite` (public, invite-token redemption)
- `POST /auth/register-public` (public, disabled unless `AUTH_PUBLIC_REGISTER_ENABLED=true`)
- `GET /me` (requires JWT bearer token or auth cookie)
- Auth rate limits:
  - `/auth/login`: 8 requests/minute per client
  - `/auth/register`: 5 requests/minute per client
- Demo seeded admin credentials:
  - Email: `admin@demo.emoto`
  - Phone: `+250700000001`
  - Password: `ChangeMe123!`

## Dashboard Auth Feature Flags
The dashboard auth UI can wire into optional backend capabilities via environment flags:
- `NEXT_PUBLIC_GOOGLE_OAUTH_URL`: OAuth URL for Google sign-in (leave blank to disable).
- `NEXT_PUBLIC_APPLE_OAUTH_URL`: OAuth URL for Apple sign-in (leave blank to disable).
- `NEXT_PUBLIC_PASSWORD_RESET_ENDPOINT`: Relative or absolute endpoint for reset requests (e.g. `/auth/forgot-password`).
- `NEXT_PUBLIC_ENABLE_FULLNAME`: Set to `1` when the API supports `fullName` on registration payloads.
- `AUTH_COOKIE_NAME`: Name of the httpOnly cookie storing the access token.
- `AUTH_COOKIE_SECURE`: Set to `true` in production HTTPS deployments.
- `AUTH_COOKIE_SAMESITE`: Cookie SameSite policy (`lax`, `strict`, or `none`).
- `AUTH_COOKIE_DOMAIN`: Optional cookie domain for multi-subdomain setups.
- `AUTH_REMEMBER_ME_EXPIRES_IN`: JWT expiry used when `rememberMe=true` (e.g. `30d`).
- `AUTH_REMEMBER_ME_DAYS`: Cookie max-age in days when `rememberMe=true`.

## Swagger
- `http://localhost:3000/docs`
- Swagger JSON: `http://localhost:3000/docs-json`

## Dashboard OpenAPI Types
- Generate dashboard API types from Swagger:
```bash
npm run gen:types -w apps/dashboard
```
- Output file: `apps/dashboard/src/lib/api-types.ts`

## Audit Logs
- Admin control-plane actions are persisted in `AuditLog` table:
  - Device secret rotations
  - Zone create/update/delete
  - Bike lock/unlock action requests

## MQTT Contract
- Contract and signing rules: `docs/mqtt-contract.md`

## Incidents
- Lifecycle and notification outbox details: `docs/incidents.md`
- CRASH incidents also fan out signed partner webhooks via notification outbox.
- Evidence packs are generated on demand and stored in S3/MinIO.

## Partner API
- Partner auth and endpoint contract: `docs/partner-api.md`
- Partner documentation page: `http://localhost:3000/partner/docs`
- Create or rotate partner clients locally:
```bash
cd apps/api
npm run partner:create-client
```

## Docker Ports
- API: `${API_HOST_PORT:-3000}` -> container `3000`
- PostgreSQL: `5432`
- Redis: `6379`
- EMQX MQTT: `1883`
- EMQX dashboard: `18083`
- MinIO API: `9000`
- MinIO console: `9001`

TimescaleDB extension is auto-enabled on first database initialization via `docker/postgres/init/01-timescaledb.sql`.
TelemetryPoint is configured as a Timescale hypertable with compression after 7 days and retention at 180 days.

## Root npm Scripts
```bash
npm run dev:stack:up
npm run dev:stack:down
npm run dev:stack:logs
npm run dev:api
npm run dev:worker
npm run dev:dashboard
npm run dev:rider
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
npm run mqtt:publish:sample
npm run mqtt:publish:sample:ack
npm run partner:create-client
npm run format
```

## Sample `.env`
```env
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=0
EXPO_PUBLIC_API_URL=http://localhost:3000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=emoto_fleet
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/emoto_fleet

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_URL=mqtt://localhost:1883
MQTT_DISABLED=false
MQTT_SAMPLE_DEVICE_UID=DEV-0001
MQTT_SAMPLE_DEVICE_SECRET=device-secret-0001
MQTT_SAMPLE_COMMAND_ID=00000000-0000-0000-0000-000000000000
MQTT_SAMPLE_ACK_STATUS=ACKED
MQTT_SAMPLE_ACK_ERROR_MESSAGE=Simulated device failure

EMQX_DASHBOARD_PORT=18083
EMQX_DASHBOARD_USERNAME=admin
EMQX_DASHBOARD_PASSWORD=public

MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=emoto-evidence
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
S3_PRESIGN_EXPIRES_SECONDS=600

DEVICE_SECRET_MASTER_KEY=change_me_device_secret_master_key_32chars
COMMAND_TTL_SECONDS=45
INCIDENT_CRASH_MIN_SEVERITY=HIGH
JWT_SECRET=change_me_change_me
JWT_EXPIRES_IN=1h
PARTNER_JWT_SECRET=change_me_partner_jwt_secret
PARTNER_JWT_EXPIRES_IN=1h
PARTNER_WEBHOOK_SECRET_MASTER_KEY=change_me_partner_webhook_secret_master_key_32chars
AUTH_REGISTER_ENABLED=false
AUTH_PUBLIC_REGISTER_ENABLED=false
INVITE_TOKEN_TTL_HOURS=168
BCRYPT_SALT_ROUNDS=10
SEED_ADMIN_PASSWORD=ChangeMe123!
SEED_DEVICE_UID=DEV-0001
SEED_DEVICE_SECRET=device-secret-0001
SEED_PARTNER_CLIENT_ID=partner-demo-client
SEED_PARTNER_CLIENT_SECRET=PartnerSecret123!
SEED_PARTNER_SCOPES=insurer:read webhooks:write

TRIP_START_SPEED_KPH=5
TRIP_END_SPEED_KPH=5
TRIP_START_MOVEMENT_SECONDS=30
TRIP_END_IDLE_SECONDS=300
TRIP_SCORE_MIN_DISTANCE_KM=1
TRIP_SCORE_PENALTY_MULTIPLIER=20
TRIP_SCORE_WEIGHT_OVERSPEED=1.2
TRIP_SCORE_WEIGHT_HARSH_BRAKE=1
TRIP_SCORE_WEIGHT_HARSH_ACCEL=0.8
TRIP_SCORE_WEIGHT_HARSH_CORNER=0.8
TRIP_SCORE_WEIGHT_CRASH=4
TRIP_SCORE_WEIGHT_THEFT_SUSPECTED=3
```

## Rider App
- Location: `apps/rider`
- Copy rider env sample:
```bash
cp apps/rider/.env.example apps/rider/.env
```
- Start Expo:
```bash
npm run dev:rider
```
- Rider flow included in scaffold:
  - Login (phone + password)
  - Home score/quick stats
  - Trips list + trip detail
  - SOS confirm/action
  - Nearby POIs via device GPS

## Telemetry Ingestion
- API subscribes to:
  - `v1/devices/+/telemetry`
  - `v1/devices/+/event`
- Publish a signed sample message:
```bash
npm run mqtt:publish:sample
```
- Publish a signed command ack sample message:
```bash
npm run mqtt:publish:sample:ack
```

Trip lifecycle:
- start when speed >= `TRIP_START_SPEED_KPH` for `TRIP_START_MOVEMENT_SECONDS` or ignition=true
- end when speed < `TRIP_END_SPEED_KPH` for `TRIP_END_IDLE_SECONDS` or ignition=false with no movement
