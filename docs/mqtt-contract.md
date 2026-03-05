# MQTT Telemetry Contract (v1)

This document defines the MQTT topics, payload schema, and signing/anti-replay rules for device ingestion.

## Topics

- Telemetry topic: `v1/devices/{deviceUid}/telemetry`
- Event topic: `v1/devices/{deviceUid}/event`

`{deviceUid}` is the fleet device identifier provisioned by the API.

## Telemetry Payload

Publish JSON with this shape:

```json
{
  "ts": "2026-03-04T12:34:56.000Z",
  "lat": -1.944,
  "lng": 30.061,
  "speedKph": 42.3,
  "heading": 120,
  "accel": { "x": 0.1, "y": -0.2, "z": 9.7 },
  "batteryV": 52.1,
  "ignition": true,
  "nonce": "6ed76f41-b839-4fb2-8f43-5678ea5fbdf9",
  "sig": "hex-hmac-sha256"
}
```

Field notes:
- `ts`: ISO8601 UTC timestamp with timezone offset.
- `lat`, `lng`: GPS coordinates.
- `speedKph`: speed in km/h.
- `heading`: optional, degrees (0..360).
- `accel`: optional acceleration in m/s^2.
- `batteryV`: optional battery voltage.
- `ignition`: optional ignition state.
- `nonce`: UUID used once per message.
- `sig`: lowercase/uppercase hex HMAC-SHA256 signature.

## Event Payload

For `v1/devices/{deviceUid}/event`, use:

```json
{
  "ts": "2026-03-04T12:34:56.000Z",
  "type": "HARSH_BRAKE",
  "severity": "HIGH",
  "meta": { "speedKph": 55.2 },
  "nonce": "fc94e113-5371-4425-b534-ec015e9ad645",
  "sig": "hex-hmac-sha256"
}
```

`severity` must be one of `LOW | MEDIUM | HIGH | CRITICAL`.

## Signing

Each device has a provisioning secret (`deviceSecret`) returned one-time by the API.

Compute signature as:

```text
sig = HMAC_SHA256(deviceSecret, canonicalJSONString(payloadWithoutSig))
```

Where:
- `payloadWithoutSig` is the full JSON object excluding `sig`.
- `canonicalJSONString(...)` is JSON serialized with:
  - object keys sorted lexicographically at every nesting level,
  - arrays kept in original order,
  - no additional whitespace.

Node.js example:

```ts
import { createHmac } from 'crypto';

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortDeep(v)]),
    );
  }
  return value;
}

function canonicalJSONString(payloadWithoutSig: unknown): string {
  return JSON.stringify(sortDeep(payloadWithoutSig));
}

function computeSig(deviceSecret: string, payloadWithoutSig: unknown): string {
  return createHmac('sha256', deviceSecret)
    .update(canonicalJSONString(payloadWithoutSig))
    .digest('hex');
}
```

## Validation Rules

Message is rejected if any of the following occurs:
- Payload fails Zod schema validation.
- Topic does not match supported topic patterns.
- Signature is invalid.
- Timestamp drift is more than 5 minutes from server time.
- Replay `nonce` was already seen in last 10 minutes for same device.

Nonce replay cache:
- Redis key: `mqtt:nonce:{deviceUid}:{nonce}`
- TTL: `600` seconds (10 minutes)
- Insert mode: `SET key value EX 600 NX`

## Utility References

Implemented in:
- `apps/api/src/mqtt/mqtt-validation.util.ts`

Key exported utilities:
- `telemetryPayloadSchema`, `eventPayloadSchema`
- `parseMqttTopic(...)`
- `canonicalJSONString(...)`
- `computePayloadSignature(...)`
- `verifyPayloadSignature(...)`
- `assertTimestampDrift(...)`
- `assertNonceNotReplayed(...)`

