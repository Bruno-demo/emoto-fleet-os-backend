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

## Swagger
- `http://localhost:3000/docs`

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

EMQX_DASHBOARD_PORT=18083
EMQX_DASHBOARD_USERNAME=admin
EMQX_DASHBOARD_PASSWORD=public

JWT_SECRET=change_me_change_me
JWT_EXPIRES_IN=1h
```
