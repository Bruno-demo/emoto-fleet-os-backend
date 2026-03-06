import { randomUUID } from 'crypto';
import mqtt from 'mqtt';
import { computePayloadSignature } from '../src/mqtt/mqtt-validation.util';

interface CommandAckPayloadWithoutSig {
  commandId: string;
  status: 'ACKED' | 'FAILED';
  ts: string;
  nonce: string;
  errorMessage?: string;
}

// Validates uuid format for command id env input.
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

// Builds a signed command ack payload for local ingestion testing.
function buildSampleAckPayload(): CommandAckPayloadWithoutSig {
  const commandId = process.env.MQTT_SAMPLE_COMMAND_ID;
  if (!commandId || !isUuid(commandId)) {
    throw new Error(
      'Missing valid MQTT_SAMPLE_COMMAND_ID (uuid) for command ack script.',
    );
  }

  const status =
    process.env.MQTT_SAMPLE_ACK_STATUS === 'FAILED' ? 'FAILED' : 'ACKED';
  const errorMessage =
    status === 'FAILED'
      ? process.env.MQTT_SAMPLE_ACK_ERROR_MESSAGE ?? 'Simulated device failure'
      : undefined;

  return {
    commandId,
    status,
    ts: new Date().toISOString(),
    nonce: randomUUID(),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

// Masks device identifiers before logging script output.
function truncateDeviceUid(deviceUid: string): string {
  if (deviceUid.length <= 8) {
    return `${deviceUid.slice(0, 2)}***${deviceUid.slice(-2)}`;
  }

  return `${deviceUid.slice(0, 4)}...${deviceUid.slice(-4)}`;
}

// Connects to MQTT, publishes one signed command-ack message, and exits.
async function main(): Promise<void> {
  const mqttUrl = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
  const deviceUid = process.env.MQTT_SAMPLE_DEVICE_UID ?? 'DEV-0001';
  const deviceSecret = process.env.MQTT_SAMPLE_DEVICE_SECRET;

  if (!deviceSecret) {
    throw new Error(
      'Missing MQTT_SAMPLE_DEVICE_SECRET. Provide a provisioning secret in .env.',
    );
  }

  const unsignedPayload = buildSampleAckPayload();
  const sig = computePayloadSignature(deviceSecret, unsignedPayload);
  const payload = {
    ...unsignedPayload,
    sig,
  };

  const topic = `v1/devices/${deviceUid}/command-ack`;
  const client = mqtt.connect(mqttUrl);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out connecting to MQTT broker'));
    }, 10_000);

    client.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    client.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  client.end(true);

  console.log(
    `Published sample command ack to ${topic} for device ${truncateDeviceUid(deviceUid)}`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to publish sample command ack: ${message}`);
  process.exitCode = 1;
});
