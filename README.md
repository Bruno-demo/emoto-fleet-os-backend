# emoto-fleet-os-backend

Backend scaffold for e-moto telematics using NestJS + TypeScript.

## Stack
- NestJS API in `apps/api`
- PostgreSQL (TimescaleDB image) via Docker Compose
- Redis via Docker Compose
- EMQX MQTT broker via Docker Compose

## Prerequisites
- Node.js 22+
- npm 11+
- Docker + Docker Compose

## Setup
1. Copy env values:
```bash
cp .env.example .env
```
2. Start infrastructure:
```bash
docker compose up -d
```
3. Run Prisma migration + seed:
```bash
npm run db:migrate
npm run db:seed
```
4. Start API:
```bash
cd apps/api
npm install
npm run start:dev
```

API should run at `http://localhost:3000`.

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
- Server events: `bike_state`, `new_event`, `command_status`
- Full contract: `docs/websocket.md`

## Auth Endpoints
- `POST /auth/login` with `email+password` or `phone+password`
- `POST /auth/register` (OWNER/ADMIN only, disabled by default via env)
- `GET /me` (requires JWT bearer token)
- Auth rate limits:
  - `/auth/login`: 8 requests/minute per client
  - `/auth/register`: 5 requests/minute per client
- Demo seeded admin credentials:
  - Email: `admin@demo.emoto`
  - Phone: `+250700000001`
  - Password: `ChangeMe123!`

## Swagger
- `http://localhost:3000/docs`

## Audit Logs
- Admin control-plane actions are persisted in `AuditLog` table:
  - Device secret rotations
  - Zone create/update/delete
  - Bike lock/unlock action requests

## MQTT Contract
- Contract and signing rules: `docs/mqtt-contract.md`

## Docker Ports
- PostgreSQL: `5432`
- Redis: `6379`
- EMQX MQTT: `1883`
- EMQX dashboard: `18083`

TimescaleDB extension is auto-enabled on first database initialization via `docker/postgres/init/01-timescaledb.sql`.

## Root npm Scripts
```bash
npm run dev:stack:up
npm run dev:stack:down
npm run dev:stack:logs
npm run dev:api
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
npm run mqtt:publish:sample
npm run mqtt:publish:sample:ack
npm run lint
npm run format
```

## Sample `.env`
```env
NODE_ENV=development
PORT=3000

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
MQTT_SAMPLE_DEVICE_UID=DEV-0001
MQTT_SAMPLE_DEVICE_SECRET=device-secret-0001
MQTT_SAMPLE_COMMAND_ID=00000000-0000-0000-0000-000000000000
MQTT_SAMPLE_ACK_STATUS=ACKED
MQTT_SAMPLE_ACK_ERROR_MESSAGE=Simulated device failure

EMQX_DASHBOARD_PORT=18083
EMQX_DASHBOARD_USERNAME=admin
EMQX_DASHBOARD_PASSWORD=public

DEVICE_SECRET_MASTER_KEY=change_me_device_secret_master_key_32chars
COMMAND_TTL_SECONDS=45
JWT_SECRET=change_me_change_me
JWT_EXPIRES_IN=1h
AUTH_REGISTER_ENABLED=false
BCRYPT_SALT_ROUNDS=10
SEED_ADMIN_PASSWORD=ChangeMe123!
SEED_DEVICE_UID=DEV-0001
SEED_DEVICE_SECRET=device-secret-0001

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
