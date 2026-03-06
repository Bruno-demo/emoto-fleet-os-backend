# Partner API (Insurer Integrations)

This API is separated from fleet-user auth and uses partner client credentials.

## Auth Flow

`POST /partner/oauth/token`

Request:

```json
{
  "clientId": "partner-demo-client",
  "clientSecret": "PartnerSecret123!"
}
```

Response:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "scopes": ["insurer:read", "webhooks:write"]
}
```

Use the token for all partner endpoints:

```bash
curl -H "Authorization: Bearer <jwt>" \
  http://localhost:3000/partner/fleets/<fleetId>/weekly-summary
```

## Authorization Rules

- Partner access is enforced via `PartnerFleetAccess` rows.
- Requests to non-granted fleets return `403`.
- Read endpoints require scope `insurer:read`.
- Webhook registration requires scope `webhooks:write`.

## Endpoints

- `GET /partner/fleets/:fleetId/weekly-summary?from&to`
  - Returns aggregate-only metrics: trip/event/incident/crash counts and average score.
- `GET /partner/bikes/:bikeId/trips?from&to&page&pageSize`
  - Returns trip summaries only (no point-by-point telemetry).
- `GET /partner/incidents/:incidentId`
  - Returns incident metadata + nearby event timeline.
  - Event metadata is location-sanitized (rounded coordinates).
- `GET /partner/incidents/:incidentId/evidence-pack`
  - Returns short-lived presigned URLs for summary JSON + telemetry CSV.
  - Access is allowed only when partner has active `PartnerFleetAccess` for the incident fleet.
- `POST /partner/webhooks`
  - Registers an HMAC-signed webhook endpoint for incident alerts.

## Webhook Event

CRASH incidents create webhook outbox deliveries for active partner webhooks with fleet access.

- Notification outbox retries up to 3 attempts with exponential backoff.
- Delivery records are persisted in `Notification` with status and attempt counts.

Headers:

- `X-Emoto-Signature`: `hex(hmac_sha256(webhookSecret, rawBody))`
- `X-Emoto-Timestamp`: ISO timestamp

Payload example:

```json
{
  "event": "incident.crash.created",
  "incident": {
    "id": "uuid",
    "fleetId": "uuid",
    "bikeId": "uuid",
    "deviceId": "uuid",
    "eventId": "12345",
    "status": "OPEN",
    "createdAt": "2026-03-06T12:00:00.000Z"
  },
  "crash": {
    "type": "CRASH",
    "severity": "CRITICAL",
    "ts": "2026-03-06T11:59:57.000Z"
  }
}
```
