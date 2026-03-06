# Fleet Dashboard WebSocket Contract

This document describes the Socket.IO contract for real-time fleet dashboards.

## Endpoint

- Namespace: `/fleet-events`
- Transport: Socket.IO over WebSocket/HTTP long polling fallback

## Authentication

Handshake requires a valid JWT access token issued by `POST /auth/login`.

Supported token locations:
- `auth.token` (recommended)
- `auth.authorization` (`Bearer <token>`)
- `Authorization` header (`Bearer <token>`)

Invalid or missing token causes handshake rejection.

## Fleet Isolation

After successful auth, server joins the socket to room `fleet:{fleetId}`.
All server pushes are emitted only to the authenticated fleet room.

## Client Event

### `subscribe_live`

Client asks to start live stream delivery.

Payload:

```json
{}
```

Ack response:

```json
{
  "subscribed": true,
  "fleetId": "00000000-0000-0000-0000-000000000001"
}
```

## Server Events

### `bike_state`

Emitted when latest bike state changes. Delivery is throttled to max 1 event/sec per bike.

```json
{
  "bikeId": "f9d7...",
  "deviceId": "9f7d...",
  "ts": "2026-03-06T10:12:34.000Z",
  "lat": -1.944,
  "lng": 30.061,
  "speedKph": 42.3,
  "heading": 120,
  "batteryV": 52.1,
  "ignition": true
}
```

### `new_event`

Emitted immediately when an `Event` row is created.

```json
{
  "id": "12345",
  "bikeId": "f9d7...",
  "deviceId": "9f7d...",
  "ts": "2026-03-06T10:12:34.000Z",
  "type": "OVERSPEED",
  "severity": "MEDIUM",
  "metaJson": {
    "speedKph": 48.3,
    "speedLimitKph": 30
  },
  "createdAt": "2026-03-06T10:12:34.123Z"
}
```

### `command_status`

Emitted when a device/bike command status changes.

Status values:
- `PENDING`
- `SENT`
- `ACKED`
- `FAILED`
- `EXPIRED`

```json
{
  "commandId": "f6fcb4e5-7abd-4661-b22b-2d85e509f3ff",
  "status": "ACKED",
  "ts": "2026-03-06T10:12:34.000Z",
  "bikeId": "f9d7...",
  "deviceId": "9f7d...",
  "action": "LOCK"
}
```

## Example Client (TypeScript)

```ts
import { io } from 'socket.io-client';

const token = '<jwt-access-token>';

const socket = io('http://localhost:3000/fleet-events', {
  auth: {
    token,
  },
});

socket.on('connect', () => {
  socket.emit('subscribe_live', {}, (ack: { subscribed: boolean }) => {
    console.log('subscribe_live ack', ack);
  });
});

socket.on('bike_state', (payload) => console.log('bike_state', payload));
socket.on('new_event', (payload) => console.log('new_event', payload));
socket.on('command_status', (payload) =>
  console.log('command_status', payload),
);
```
