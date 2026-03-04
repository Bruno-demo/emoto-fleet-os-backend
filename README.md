# emoto-fleet-os-backend

Backend platform for e-moto fleet telematics.

## Stack
- Node.js + TypeScript + NestJS
- PostgreSQL + TimescaleDB extension
- Redis
- EMQX (MQTT broker)
- Docker Compose

## Prerequisites
- Node.js 20+
- npm 10+
- Docker + Docker Compose

## Setup
```bash
npm install
cp .env.example .env
docker compose up -d
npm run start:dev
```

## Sample `.env`
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/emoto_fleet
REDIS_URL=redis://localhost:6379
MQTT_URL=mqtt://localhost:1883
JWT_SECRET=change_me
JWT_EXPIRES_IN=1h
```

## Suggested Dev Commands
```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Security & Data Handling
- Do not log PII (phone numbers, precise home locations).
- Mask identifiers in logs.
- Enforce RBAC and fleet isolation on all protected resources.
- Ensure auth + authorization checks for every endpoint.

## API Docs
Expose public endpoint documentation with OpenAPI/Swagger.

## Testing Scope
Include basic tests for:
- Auth
- Ingestion pipeline
- Scoring
