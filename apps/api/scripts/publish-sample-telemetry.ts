import { randomUUID } from 'crypto';
import mqtt from 'mqtt';
import { computePayloadSignature } from '../src/mqtt/mqtt-validation.util';

interface TelemetryPayloadWithoutSig {
  ts: string;
  lat: number;
  lng: number;
  speedKph: number;
  heading?: number;
  accel?: {
    x: number;
    y: number;
    z: number;
  };
  batteryV?: number;
  ignition?: boolean;
  nonce: string;
}

// Builds a sample telemetry payload used for local broker testing.
function buildSamplePayload(): TelemetryPayloadWithoutSig {
  return {
    ts: new Date().toISOString(),
    lat: -1.944,
    lng: 30.061,
    speedKph: 42.3,
    heading: 120,
    accel: {
      x: 0.1,
      y: -0.2,
      z: 9.7,
    },
    batteryV: 52.1,
    ignition: true,
    nonce: randomUUID(),
  };
}

// Masks device identifiers before logging command output.
function truncateDeviceUid(deviceUid: string): string {
  if (deviceUid.length <= 8) {
    return `${deviceUid.slice(0, 2)}***${deviceUid.slice(-2)}`;
  }

  return `${deviceUid.slice(0, 4)}...${deviceUid.slice(-4)}`;
}

// Connects to EMQX, publishes one signed telemetry message, and exits.
async function main(): Promise<void> {
  const mqttUrl = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
  const deviceUid = process.env.MQTT_SAMPLE_DEVICE_UID ?? 'DEV-0001';
  const deviceSecret = process.env.MQTT_SAMPLE_DEVICE_SECRET;

  if (!deviceSecret) {
    throw new Error(
      'Missing MQTT_SAMPLE_DEVICE_SECRET. Provide a provisioning secret in .env.',
    );
  }

  const unsignedPayload = buildSamplePayload();
  const sig = computePayloadSignature(deviceSecret, unsignedPayload);
  const payload = {
    ...unsignedPayload,
    sig,
  };
  const topic = `v1/devices/${deviceUid}/telemetry`;

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
    `Published sample telemetry to ${topic} for device ${truncateDeviceUid(deviceUid)}`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to publish sample telemetry: ${message}`);
  process.exitCode = 1;
});
