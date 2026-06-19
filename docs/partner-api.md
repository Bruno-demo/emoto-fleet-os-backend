# Partner API (Insurer Integrations)

This API allows authorized partners (e.g., insurance providers, enterprise compliance auditors) to retrieve fleet telemetry summaries, incident reports, and subscribe to real-time events via webhooks. It is structurally separated from standard fleet-user authentication and relies on dedicated Partner Client Credentials.

## 1. Authentication flow

Partners authenticate using the OAuth2 Client Credentials flow.

`POST /partner/oauth/token`

**Request:**
```json
{
  "clientId": "partner-demo-client",
  "clientSecret": "PartnerSecret123!"
}
```

**Response:**
```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "scopes": ["insurer:read", "webhooks:write"]
}
```

Include the resulting token in the `Authorization` header for all requests:
```bash
curl -H "Authorization: Bearer <jwt>" \
  https://api.emotofleet.com/partner/fleets/<fleetId>/weekly-summary
```

## 2. Authorization & Scopes

- Partner access is explicitly enforced via `PartnerFleetAccess` grants. Attempting to query data or subscribe to webhooks for non-granted fleets will return a `403 Forbidden`.
- **Read APIs** (summaries, incidents, trips) require the `insurer:read` scope.
- **Subscription APIs** (webhooks) require the `webhooks:write` scope.

## 3. Data Retrieval Endpoints

- `GET /partner/bikes?page&pageSize&limit`
  - Returns a paginated list of all bikes assigned to the partner. If the partner is an insurer, it isolates the list to bikes where `insurerName` matches the insurer's company name.
- `GET /partner/fleets/:fleetId/weekly-summary?from&to`
  - Returns aggregate-only fleet performance metrics including total trip bounds, incident counts, crash occurrences, and the average fleet score.
- `GET /partner/bikes/:bikeId/trips?from&to&page&pageSize`
  - Returns generalized trip summaries (excludes raw point-by-point spatial telemetry for privacy).
- `GET /partner/incidents/:incidentId`
  - Returns incident details combined with a surrounding event timeline. Note: All event data has its coordinate precision rounded to 3 decimal places to sanitize exact locations.
- `GET /partner/incidents/:incidentId/evidence-pack`
  - Generates and returns short-lived, presigned URLs allowing partners to download the full evidence pack (Summary JSON + Telemetry CSV). Access is rigorously gatekept to active `PartnerFleetAccess` relationships.

---

## 4. Webhook Event Subscription Process

Partners can subscribe to real-time critical events (e.g., `CRASH` alerts) utilizing the webhook subscription workflow. When an event triggers, E-Moto Fleet OS securely posts the payload to the partner's registered URL.

### 4.1. Creating a Subscription

To subscribe, register a secure `https://` callback endpoint.

`POST /partner/webhooks`

**Request:**
```json
{
  "url": "https://insurer.example.com/webhooks/emoto",
  "secret": "optional-custom-secret-string",
  "active": true
}
```
*Note: If `secret` is omitted, the API will securely generate and return a one-time 24-byte hex secret.*

**Response:**
```json
{
  "id": 105,
  "url": "https://insurer.example.com/webhooks/emoto",
  "active": true,
  "secret": "generated-or-provided-secret"
}
```
*Store this `secret` safely on your end. It is never returned again and is required to verify payload authenticity.*

### 4.2. Event Delivery & Retries

When a `CRASH` incident occurs within an authorized fleet, our backend Notification Outbox enqueues the delivery.
- **Retries**: If your server fails to respond with a `2xx` success code, the outbox automatically retries delivery up to **3 times** using exponential backoff.
- **Audit Logs**: Webhook delivery attempts (along with status and attempt counts) are permanently persisted in the `Notification` system and partner audit logs.

### 4.3. Verifying the Webhook Payload

E-Moto Fleet OS signs every webhook payload request using your endpoint's `secret`. 

**Included Headers:**
- `X-Emoto-Timestamp`: ISO timestamp of when the request was dispatched.
- `X-Emoto-Signature`: The hex representation of the HMAC-SHA256 signature calculated against the raw stringified body.

**Verification Example (Node.js):**
```javascript
const crypto = require('crypto');

function verifySignature(rawBody, signatureHeader, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
}
```

### 4.4. Example Payload (`incident.crash.created`)

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
