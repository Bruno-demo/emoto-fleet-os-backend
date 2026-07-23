import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { EventType } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

const finiteNumber = z.number().finite();
const signatureHexSchema = z.string().regex(/^[a-f0-9]{64}$/i);

export const MQTT_TELEMETRY_TOPIC_REGEX = /^v1\/devices\/([^/]+)\/telemetry$/;
export const MQTT_EVENT_TOPIC_REGEX = /^v1\/devices\/([^/]+)\/event$/;
export const MQTT_COMMAND_TOPIC_REGEX = /^v1\/devices\/([^/]+)\/command$/;
export const MQTT_COMMAND_ACK_TOPIC_REGEX =
  /^v1\/devices\/([^/]+)\/command-ack$/;

export const MQTT_MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
export const MQTT_NONCE_TTL_SECONDS = 10 * 60;

const telemetryPayloadWithoutSigSchema = z.object({
  ts: z.string().datetime({ offset: true }),
  lat: finiteNumber.min(-90).max(90),
  lng: finiteNumber.min(-180).max(180),
  speedKph: finiteNumber.min(0).max(300),
  heading: finiteNumber.min(0).max(360).optional(),
  accel: z
    .object({
      x: finiteNumber,
      y: finiteNumber,
      z: finiteNumber,
    })
    .optional(),
  batteryV: finiteNumber.min(0).max(200).optional(),
  batteryPct: finiteNumber.min(0).max(100).optional(),
  ignition: z.boolean().optional(),
  mainPowerCut: z.boolean().optional(),
  nonce: z.string().uuid(),
});

export const telemetryPayloadSchema = telemetryPayloadWithoutSigSchema.extend({
  sig: signatureHexSchema,
});

const eventPayloadWithoutSigSchema = z.object({
  ts: z.string().datetime({ offset: true }),
  type: z.nativeEnum(EventType),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  meta: z.record(z.string(), z.unknown()).default({}),
  nonce: z.string().uuid(),
});

export const eventPayloadSchema = eventPayloadWithoutSigSchema.extend({
  sig: signatureHexSchema,
});

const commandDownlinkPayloadWithoutSigSchema = z.object({
  commandId: z.string().uuid(),
  type: z.enum(['LOCK', 'UNLOCK']),
  ts: z.string().datetime({ offset: true }),
  nonce: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: true }),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const commandDownlinkPayloadSchema =
  commandDownlinkPayloadWithoutSigSchema.extend({
    sig: signatureHexSchema,
  });

const commandAckPayloadWithoutSigSchema = z.object({
  commandId: z.string().uuid(),
  status: z.enum(['ACKED', 'FAILED']),
  ts: z.string().datetime({ offset: true }),
  nonce: z.string().uuid(),
  errorMessage: z.string().min(1).max(500).optional(),
});

export const commandAckPayloadSchema = commandAckPayloadWithoutSigSchema.extend(
  {
    sig: signatureHexSchema,
  },
);

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
export type EventPayload = z.infer<typeof eventPayloadSchema>;
export type CommandDownlinkPayloadWithoutSig = z.infer<
  typeof commandDownlinkPayloadWithoutSigSchema
>;
export type CommandDownlinkPayload = z.infer<
  typeof commandDownlinkPayloadSchema
>;
export type CommandAckPayload = z.infer<typeof commandAckPayloadSchema>;

export type ParsedMqttTopic =
  | { kind: 'telemetry'; deviceUid: string }
  | { kind: 'event'; deviceUid: string }
  | { kind: 'commandAck'; deviceUid: string };

export class MqttValidationError extends Error {}

// Parses supported topic formats and returns message kind plus device UID.
export function parseMqttTopic(topic: string): ParsedMqttTopic | null {
  const telemetryMatch = MQTT_TELEMETRY_TOPIC_REGEX.exec(topic);
  if (telemetryMatch) {
    return {
      kind: 'telemetry',
      deviceUid: telemetryMatch[1],
    };
  }

  const eventMatch = MQTT_EVENT_TOPIC_REGEX.exec(topic);
  if (eventMatch) {
    return {
      kind: 'event',
      deviceUid: eventMatch[1],
    };
  }

  const commandAckMatch = MQTT_COMMAND_ACK_TOPIC_REGEX.exec(topic);
  if (commandAckMatch) {
    return {
      kind: 'commandAck',
      deviceUid: commandAckMatch[1],
    };
  }

  return null;
}

// Converts a payload into canonical JSON with recursively sorted object keys.
export function canonicalJSONString(payloadWithoutSig: unknown): string {
  return JSON.stringify(sortObjectKeysDeep(payloadWithoutSig));
}

// Produces HMAC-SHA256 signature for a payload using canonical JSON bytes.
export function computePayloadSignature(
  deviceSecret: string,
  payloadWithoutSig: unknown,
): string {
  return createHmac('sha256', deviceSecret)
    .update(canonicalJSONString(payloadWithoutSig))
    .digest('hex');
}

// Verifies that payload signature matches the expected HMAC for this device secret.
export function verifyPayloadSignature(
  deviceSecret: string,
  payload: Record<string, unknown> & { sig: string },
): boolean {
  const providedSig = payload.sig;
  if (!signatureHexSchema.safeParse(providedSig).success) {
    return false;
  }

  const unsignedPayload: Record<string, unknown> = { ...payload };
  delete unsignedPayload.sig;
  const expectedSig = computePayloadSignature(deviceSecret, unsignedPayload);
  return timingSafeHexEqual(providedSig, expectedSig);
}

// Rejects timestamps outside the accepted drift window relative to current time.
export function assertTimestampDrift(
  ts: string,
  nowMs = Date.now(),
  maxDriftMs = MQTT_MAX_TIMESTAMP_DRIFT_MS,
): void {
  const timestampMs = Date.parse(ts);
  if (Number.isNaN(timestampMs)) {
    throw new MqttValidationError('Invalid timestamp format');
  }

  if (Math.abs(nowMs - timestampMs) > maxDriftMs) {
    throw new MqttValidationError('Timestamp drift exceeds 5 minute window');
  }
}

// Stores nonce with TTL and throws if the same nonce was already seen recently.
export async function assertNonceNotReplayed(
  redisService: RedisService,
  deviceUid: string,
  nonce: string,
  ttlSeconds = MQTT_NONCE_TTL_SECONDS,
): Promise<void> {
  const nonceKey = buildNonceKey(deviceUid, nonce);
  const accepted = await redisService.setIfNotExists(nonceKey, '1', ttlSeconds);
  if (!accepted) {
    throw new MqttValidationError('Replay nonce detected');
  }
}

// Builds a deterministic Redis key used to track nonce replay windows.
export function buildNonceKey(deviceUid: string, nonce: string): string {
  return `mqtt:nonce:${deviceUid}:${nonce}`;
}

// Recursively sorts object keys while preserving array order for stable signing.
function sortObjectKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeysDeep(item));
  }

  if (isPlainObject(value)) {
    const sortedEntries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return Object.fromEntries(
      sortedEntries.map(([key, nestedValue]) => [
        key,
        sortObjectKeysDeep(nestedValue),
      ]),
    );
  }

  return value;
}

// Uses constant-time comparison on parsed hex signatures.
function timingSafeHexEqual(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

// Distinguishes plain objects from primitives and special runtime types.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}
