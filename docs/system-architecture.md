# eMoto Fleet OS — System Architecture & Workflow

> Auto-generated system architecture documentation covering all services, data flows, and workflows.

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Telemetry Ingestion Pipeline](#2-telemetry-ingestion-pipeline)
3. [Incident & Notification Flow](#3-incident--notification-flow)
4. [Command Downlink Lifecycle](#4-command-downlink-lifecycle)
5. [Authentication & Security Layers](#5-authentication--security-layers)
6. [Data Model (Entity Relationship)](#6-data-model)
7. [Redis Streams & Cache Architecture](#7-redis-streams--cache-architecture)
8. [Service Inventory](#8-service-inventory)
9. [MQTT Topic Contract](#9-mqtt-topic-contract)
10. [Environment Configuration](#10-environment-configuration)

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph External["External Clients"]
        Dashboard["Next.js Dashboard\n(Web Browser)"]
        RiderApp["Expo Rider App\n(Mobile)"]
        PartnerAPI["Partner Systems\n(REST API)"]
        IoTDevice["IoT Devices\n(MQTT over TLS)"]
    end

    subgraph Gateway["API Gateway :8080"]
        GW["Node.js HTTP Proxy\n- JWT Validation\n- Rate Limiting\n- CORS & Security Headers\n- Request ID Injection"]
    end

    subgraph Backend["NestJS API :3000"]
        direction TB
        Auth["Auth Module\n- JWT + Cookie\n- Account Lockout\n- RBAC (6 Roles)"]
        Ingestion["Ingestion Module\n- MQTT Consumer\n- Signature Verify\n- Nonce Replay Guard"]
        Rules["Rules Engine\n- Overspeed\n- Harsh Dynamics\n- Crash Detection\n- Theft Detection\n- Road Safety"]
        TripBuilder["Trip Builder\n- State Machine\n- Haversine Distance\n- Penalty Scoring"]
        Commands["Commands Module\n- LOCK / UNLOCK\n- HMAC Signed\n- Expiry Tracking"]
        Events["Events Module\n- WebSocket Gateway\n- Real-time Push"]
        Incidents["Incidents Module\n- Auto-create from Crash\n- Emergency Contacts\n- SMS + Webhook"]
        Partner["Partner Module\n- OAuth2 Client Creds\n- Fleet Access Control\n- Evidence Packages"]
        Metrics["Metrics Module\n- Prometheus /metrics"]
    end

    subgraph Worker["Worker Process"]
        WebhookDispatcher["Webhook Dispatcher\n- Redis Stream Consumer\n- HTTP POST + Retry"]
        NotifOutbox["Notification Outbox\n- BullMQ Jobs\n- SMS / Email / Webhook"]
    end

    subgraph StreamProc["Stream Processor"]
        SP["Node.js Consumer\n- telemetry:stream enriched\n- Speed Band Classification\n- Webhook Routing\n- Score Computation"]
    end

    subgraph DataLayer["Data Layer"]
        PG["PostgreSQL + TimescaleDB\n- Fleet, User, Bike, Device\n- TelemetryPoint (hypertable)\n- Event, Trip, Incident\n- Audit Log"]
        Redis["Redis 7.4\n- Streams (6 keys)\n- Live State Cache\n- Nonce Replay Guard\n- Rate Limit Counters\n- Trip State Machine\n- BullMQ Queue"]
        EMQX["EMQX 5.8 Broker\n- v1/devices/+/telemetry\n- v1/devices/+/event\n- v1/devices/+/command-ack\n- v1/devices/uid/command"]
        MinIO["MinIO S3\n- Evidence Packages\n- Presigned URLs"]
    end

    subgraph Monitoring["Monitoring Stack"]
        Prometheus["Prometheus"]
        Grafana["Grafana"]
        Loki["Loki + Promtail"]
    end

    Dashboard -->|HTTPS| GW
    RiderApp -->|HTTPS| GW
    PartnerAPI -->|HTTPS| GW
    GW -->|Proxy| Auth
    GW -->|WS Upgrade| Events

    IoTDevice -->|MQTT TLS| EMQX
    EMQX -->|Subscribe| Ingestion
    Ingestion -->|Persist| PG
    Ingestion -->|Publish| Redis
    Ingestion -->|Evaluate| Rules
    Ingestion -->|Update| TripBuilder
    Rules -->|Create| Events
    Incidents -->|Notify| NotifOutbox
    Commands -->|Publish| EMQX

    SP -->|Read telemetry:stream| Redis
    SP -->|Write enriched/score| Redis
    WebhookDispatcher -->|Read webhooks:outbox| Redis
    WebhookDispatcher -->|Enqueue| NotifOutbox

    Events -->|bike_state, new_event\nnew_incident, command_status| Dashboard

    Backend -->|Query/Write| PG
    Backend -->|Cache/Stream| Redis
    Worker -->|Jobs| Redis

    Metrics -->|Scrape| Prometheus
    Prometheus --> Grafana
    Loki --> Grafana
```

---

## 2. Telemetry Ingestion Pipeline

```mermaid
flowchart LR
    subgraph Device["IoT Device"]
        D["GPS + Accel + Battery\nSensor Data"]
    end

    subgraph MQTT["EMQX Broker"]
        T1["v1/devices/uid/telemetry"]
        T2["v1/devices/uid/event"]
    end

    subgraph Validate["Ingestion Validation"]
        V1["1. Parse JSON + Zod Schema"]
        V2["2. Lookup Device by UID"]
        V3["3. Verify HMAC-SHA256 Signature"]
        V4["4. Check Nonce Replay (Redis TTL 600s)"]
        V5["5. Check Timestamp Drift 5min"]
    end

    subgraph Persist["Data Persistence"]
        DB["PostgreSQL TelemetryPoint\n(TimescaleDB Hypertable)"]
        Stream["Redis Stream: telemetry:stream"]
    end

    subgraph LiveState["Live State Update"]
        Cache["Redis: live:fleet:fid:bike:bid\nTTL 3600s"]
        WS["WebSocket Push\nbike_state (throttled 1s)"]
    end

    subgraph RulesEngine["Rules Engine (5 Rules)"]
        R1["Overspeed (5s sustained)"]
        R2["Harsh Dynamics (accel thresholds)"]
        R3["Crash Detection (g-force + speed drop)"]
        R4["Theft Detection (movement w/o ignition)"]
        R5["Road Safety (OSM zones)"]
    end

    subgraph TripEngine["Trip Builder"]
        TS["State Machine: idle - active - ending"]
        Score["Trip Scoring: haversine + penalties"]
    end

    subgraph StreamProc["Stream Processor"]
        SP1["Speed Band Classification"]
        SP2["Write: telemetry:enriched"]
        SP3["Write: telemetry:score"]
        SP4["Route Critical Events to webhooks:outbox"]
    end

    D -->|MQTT Publish| T1
    D -->|MQTT Publish| T2
    T1 --> V1
    T2 --> V1
    V1 --> V2 --> V3 --> V4 --> V5

    V5 -->|Accepted| DB
    V5 -->|Accepted| Stream
    V5 -->|Accepted| Cache
    Cache --> WS

    V5 -->|Telemetry| RulesEngine
    R1 & R2 & R3 & R4 & R5 --> EV["PostgreSQL Event Table"]
    EV --> WSEV["WebSocket: new_event"]
    R3 -->|CRASH| INC["Incident Creation"]

    V5 -->|Telemetry| TS
    TS --> Score

    Stream -->|Consumer Group| SP1
    SP1 --> SP2
    SP1 --> SP3
    SP1 -->|CRASH/SOS/THEFT| SP4
```

---

## 3. Incident & Notification Flow

```mermaid
flowchart TB
    CRASH["Rules Engine Detects CRASH\ng-force > threshold + speed drop > 20kph"]

    EV["EventsService.createFleetEvent()\nEvent type=CRASH severity=CRITICAL"]
    INC["IncidentsService.createIncidentFromCrashEvent()\nIncident status=OPEN"]

    WS1["WebSocket: new_event"]
    WS2["WebSocket: new_incident"]

    EC["Load Emergency Contacts"]
    NOTIF_SMS["Create Notification channel=SMS"]
    OUTBOX_SMS["NotificationOutboxService BullMQ"]
    TWILIO["Twilio SMS Delivery"]

    STREAM_PUB["Publish to telemetry:stream kind=event"]
    SP["Stream Processor: telemetry-processors"]
    WH_OUTBOX["Write to webhooks:outbox"]
    WH_DISPATCH["WebhookDispatcherService"]
    PARTNER_LOOKUP["Lookup Active Partners"]
    NOTIF_WH["Create Notification channel=WEBHOOK"]
    HTTP_POST["HTTP POST to webhook URL\nRetry 3x exponential backoff"]

    SENT["status=SENT"]
    FAILED["status=FAILED"]

    CRASH --> EV
    EV --> WS1
    EV -->|CRASH threshold| INC
    INC --> WS2

    INC --> EC --> NOTIF_SMS --> OUTBOX_SMS --> TWILIO --> SENT

    EV --> STREAM_PUB --> SP -->|CRASH/SOS/THEFT| WH_OUTBOX --> WH_DISPATCH --> PARTNER_LOOKUP --> NOTIF_WH --> HTTP_POST
    HTTP_POST -->|Success| SENT
    HTTP_POST -->|3 Failures| FAILED
```

---

## 4. Command Downlink Lifecycle (LOCK/UNLOCK)

```mermaid
sequenceDiagram
    participant User as Fleet User (Dashboard)
    participant GW as API Gateway :8080
    participant API as NestJS API :3000
    participant DB as PostgreSQL
    participant Redis as Redis
    participant EMQX as EMQX Broker
    participant Device as IoT Device

    Note over User,Device: PHASE 1: Lock Command Request

    User->>GW: POST /bikes/{bikeId}/lock
    GW->>GW: Validate JWT + Rate Limit
    GW->>API: Proxy Request
    API->>DB: Load Bike + Device (fleet-scoped)
    API->>Redis: GET live:fleet:{fid}:bike:{bid}
    API->>API: Assert speed <= 5 kph

    API->>DB: INSERT DeviceCommand (PENDING)
    API->>DB: INSERT AuditLog (LOCK_ACTION_REQUESTED)

    Note over API,EMQX: PHASE 2: MQTT Downlink

    API->>API: Decrypt device secret (AES-GCM)
    API->>API: Sign payload (HMAC-SHA256)
    API->>EMQX: PUB v1/devices/{uid}/command
    API->>DB: UPDATE DeviceCommand status=SENT
    API-->>User: 201 {commandId, status:SENT}

    Note over EMQX,Device: PHASE 3: Device Execution

    EMQX->>Device: Deliver LOCK command
    Device->>Device: Verify signature + Execute lock
    Device->>EMQX: PUB v1/devices/{uid}/command-ack

    Note over API,Device: PHASE 4: Acknowledgement

    EMQX->>API: IngestionService receives ACK
    API->>API: Validate signature + nonce
    API->>DB: UPDATE DeviceCommand status=ACKED
    API->>DB: INSERT AuditLog (STATUS_CHANGED)
    API->>Redis: Emit WS command_status=ACKED
    Redis-->>User: WS event: command_status=ACKED
```

**Command State Machine:**

```
PENDING → SENT → ACKED (success)
                → FAILED (device error)
                → EXPIRED (timeout 120s)
```

---

## 5. Authentication & Security Layers

### Gateway Layer (Port 8080)
| Control | Details |
|---------|---------|
| **JWT Validation** | Validates JWT_SECRET (fleet) or PARTNER_JWT_SECRET (partner) |
| **Rate Limiting** | Login: 5/min, Register: 5/min, Partner: 5/min |
| **Security Headers** | HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options, Permissions-Policy |
| **Endpoint Blocking** | `/metrics` → 403, `/docs` → 403 in production |
| **CORS** | Dynamic whitelist from CORS_ORIGINS env var |

### API Layer (Port 3000)
| Control | Details |
|---------|---------|
| **Global Throttle** | 1000 req/60s per IP |
| **Account Lockout** | 5 failed logins → 15 min lockout (Redis) |
| **Login Rate Limit** | 3 req/60s |
| **RBAC** | 6 roles: OWNER > ADMIN > DISPATCHER > TECH > INSURER > RIDER |
| **Fleet Isolation** | Every DB query scoped by `WHERE fleetId = user.fleetId` |
| **Input Validation** | class-validator DTOs + Zod schemas |

### MQTT Security
| Control | Details |
|---------|---------|
| **HMAC-SHA256** | Every payload signed with per-device secret |
| **Nonce Replay** | Redis SET with 600s TTL prevents replay attacks |
| **Timestamp Drift** | Reject messages > 5 min old |
| **Secret Storage** | AES-GCM encrypted at rest, decrypted only in memory |

### Partner API Security
| Control | Details |
|---------|---------|
| **OAuth2** | Client credentials flow |
| **Fleet Access** | PartnerFleetAccess table enforces per-fleet authorization |
| **Rate Limit** | 5 token requests/min |

---

## 6. Data Model

```mermaid
erDiagram
    Fleet ||--o{ User : "has members"
    Fleet ||--o{ Bike : "owns"
    Fleet ||--o{ Device : "provisions"
    Fleet ||--o{ Event : "generates"
    Fleet ||--o{ Trip : "records"
    Fleet ||--o{ Incident : "tracks"

    Bike ||--o| Device : "paired 1:1"
    Bike ||--o{ Trip : "travels"
    Bike ||--o{ Event : "triggers"
    Bike }o--o| Rider : "assigned to"

    Device ||--o{ TelemetryPoint : "reports"
    Device ||--o{ DeviceCommand : "receives"

    Event ||--o| Incident : "triggers (CRASH)"
    Rider ||--o{ Trip : "drives"

    Partner ||--o{ PartnerWebhook : "registers"
    Partner ||--o{ PartnerFleetAccess : "authorized"
    PartnerFleetAccess }o--|| Fleet : "grants access"
    PartnerWebhook ||--o{ Notification : "delivers to"

    Fleet {
        uuid id PK
        string name
        enum type
        enum subscriptionStatus
    }
    User {
        uuid id PK
        uuid fleetId FK
        string email
        enum role
    }
    Device {
        uuid id PK
        string deviceUid UK
        uuid bikeId FK
        enum status
    }
    TelemetryPoint {
        bigint id PK
        uuid deviceId FK
        timestamptz ts
        decimal lat_lng_speed_accel_battery
    }
    Event {
        bigint id PK
        uuid fleetId FK
        enum type
        enum severity
        jsonb metaJson
    }
    Trip {
        uuid id PK
        uuid bikeId FK
        uuid riderId FK
        decimal distanceKm
        decimal score
    }
    Incident {
        uuid id PK
        uuid eventId FK
        enum status
    }
    DeviceCommand {
        uuid id PK
        uuid deviceId FK
        enum type
        enum status
        string nonce
    }
    Notification {
        uuid id PK
        enum channel
        enum status
        integer attemptCount
    }
```

### Key Tables

| Table | Engine | Notes |
|-------|--------|-------|
| `TelemetryPoint` | TimescaleDB hypertable | 7-day compression, 180-day retention |
| `Event` | PostgreSQL | Indexed on (fleetId, ts), (fleetId, type), (deviceId, ts) |
| `Trip` | PostgreSQL | Indexed on (fleetId, startTs), (bikeId, startTs) |
| `AuditLog` | PostgreSQL | Immutable append-only trail |

---

## 7. Redis Streams & Cache Architecture

### Streams

| Stream Key | Producer | Consumer Group | Purpose |
|-----------|----------|---------------|---------|
| `telemetry:stream` | IngestionService | `telemetry-processors` | Raw telemetry, events, command acks |
| `telemetry:enriched` | StreamProcessor | (analytics) | Speed band classified data |
| `telemetry:score` | StreamProcessor | (analytics) | Score deltas per telemetry point |
| `webhooks:outbox` | StreamProcessor | `webhook-dispatchers` | Events needing partner webhook delivery |
| `telemetry:trips` | TripBuilder | (analytics) | Trip summaries |
| `telemetry:rules` | RulesEngine | (analytics) | Rule violation logs |

All streams use `MAXLEN ~10000` approximate trimming.

### Cache Keys

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `live:fleet:{fid}:bike:{bid}` | 3600s | Latest bike GPS + state |
| `trip:state:{deviceId}` | 86400s | Trip state machine |
| `mqtt:nonce:{uid}:{nonce}` | 600s | Replay prevention |
| `overspeed:start:{did}:{zid}` | 120s | Sustained speed tracking |
| `event:cooldown:{did}:{type}:{variant}` | 8–300s | Alert deduplication |
| `login_attempts:{identifier}` | 900s | Account lockout counter |
| `theft:movement:start:{did}` | 300s | Ignition-off movement tracking |
| `last:speed:state:{deviceId}` | 600s | Previous speed for crash detection |

### BullMQ Queue

| Queue | Concurrency | Backoff | Max Attempts |
|-------|------------|---------|-------------|
| `notification-outbox` | 5 | Exponential + jitter (2s base) | 3 |

---

## 8. Service Inventory

| Service | Technology | Port | Role |
|---------|-----------|------|------|
| **API** | NestJS + TypeScript | 3000 | REST API, WebSocket, MQTT consumer |
| **Worker** | NestJS + TypeScript | — | Background webhook dispatch, notifications |
| **Gateway** | Raw Node.js + http-proxy | 8080 | Reverse proxy, auth, rate limiting |
| **Stream Processor** | Raw Node.js + ioredis | — | Redis stream consumer, data enrichment |
| **Dashboard** | Next.js 15 | 3001 | Web management UI |
| **Rider App** | Expo React Native | — | Mobile rider interface |
| **PostgreSQL** | TimescaleDB 2.16.1 (pg16) | 5432 | Primary relational store |
| **Redis** | Redis 7.4 Alpine | 6379 | Streams, cache, queues |
| **EMQX** | EMQX 5.8.4 | 1883/8083 | MQTT broker |
| **MinIO** | MinIO S3 | 9000 | Object storage (evidence) |

---

## 9. MQTT Topic Contract

| Topic | Direction | Payload | Auth |
|-------|-----------|---------|------|
| `v1/devices/{uid}/telemetry` | Device → Server | GPS, accel, battery, ignition | HMAC-SHA256 + nonce |
| `v1/devices/{uid}/event` | Device → Server | SOS, custom events | HMAC-SHA256 + nonce |
| `v1/devices/{uid}/command-ack` | Device → Server | Command acknowledgement | HMAC-SHA256 + nonce |
| `v1/devices/{uid}/command` | Server → Device | LOCK/UNLOCK commands | HMAC-SHA256 signed |

---

## 10. Environment Configuration

### Core Infrastructure
```
DATABASE_URL=postgresql://user:pass@postgres:5432/db
REDIS_URL=redis://redis:6379
MQTT_URL=mqtt://emqx:1883
S3_ENDPOINT=http://minio:9000
NODE_ENV=development|production
```

### Security Secrets
```
JWT_SECRET=<32+ char secret>
PARTNER_JWT_SECRET=<32+ char secret>
DEVICE_SECRET_MASTER_KEY=<AES key>
REDIS_PASSWORD=<password>
```

### Feature Flags
```
STREAM_ENABLED=true|false        # Enable Redis stream pipeline
MQTT_DISABLED=true|false         # Disable MQTT in dev
NOTIFICATION_OUTBOX_INLINE=true  # BullMQ vs inline notifications
```
