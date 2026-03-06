# Incidents Workflow

This document defines how crash incidents are created, tracked, and notified.

## Trigger

An incident is automatically created when:
- A new `Event` row has `type = CRASH`
- Event severity is at or above `INCIDENT_CRASH_MIN_SEVERITY`

When triggered:
1. Create `Incident` with status `OPEN`
2. Load active `EmergencyContact` rows for the fleet
3. Create `Notification` outbox rows (`PENDING`) for each contact (default channel `SMS`)
4. Emit websocket `new_incident` to fleet room

## Incident Lifecycle

Incident status values:
- `OPEN`: automatically created from crash detection
- `ACKNOWLEDGED`: operations team confirmed handling
- `RESOLVED`: issue closed
- `FALSE_ALARM`: reserved for manual workflows

API transitions:
- `POST /incidents/:id/acknowledge`
- `POST /incidents/:id/resolve`
- `GET /incidents/:id/evidence-pack` (generates and returns presigned links)

## Notification Outbox

Notifications are persisted first, then processed asynchronously by a BullMQ worker.

Queue:
- Name: `notification-outbox`
- Redis-backed
- Retry policy: 3 attempts, exponential backoff

Processing:
1. Worker pulls `notificationId`
2. Sends through `NotificationProvider`
3. Marks notification `SENT` and sets `sentAt`
4. On final failure, marks `FAILED` with `errorMessage`

## Provider Strategy

`NotificationProvider` is pluggable:
- Default: `ConsoleNotificationProvider` for local/dev
- Future: SMS/email/webhook providers can replace current implementation without changing incident logic.

## Security/PII

- Fleet isolation is enforced on incident/contact APIs.
- Provider logs must mask recipients; no raw phone numbers in logs.

## Evidence Packs

For crash incidents, evidence packs are generated on demand:

1. Build summary JSON:
  incident, bike, device, active trip snapshot, related events
2. Build telemetry CSV window:
  from `-120s` to `+120s` around crash timestamp
3. Upload files to object storage under:
  `evidence/{fleetId}/{incidentId}/summary.json`
  `evidence/{fleetId}/{incidentId}/telemetry-window.csv`
4. Persist one `EvidencePack` row with object keys
5. Return short-lived presigned download URLs (default 10 minutes)
