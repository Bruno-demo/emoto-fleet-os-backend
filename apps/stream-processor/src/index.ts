import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const redisUrl = process.env.STREAM_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
const streamKey = process.env.STREAM_KEY ?? 'telemetry:stream';
const streamGroup = process.env.STREAM_GROUP ?? 'telemetry-processors';
const streamConsumer = process.env.STREAM_CONSUMER ?? `processor-${process.pid}`;
const pollMs = Number(process.env.STREAM_POLL_MS ?? 1000);
const enrichedStreamKey = process.env.STREAM_ENRICHED_KEY ?? 'telemetry:enriched';
const scoreStreamKey = process.env.STREAM_SCORE_KEY ?? 'telemetry:score';
const webhookStreamKey = process.env.STREAM_WEBHOOK_KEY ?? 'webhooks:outbox';
const outputMaxLen = Number(process.env.STREAM_OUTPUT_MAX_LEN ?? 10000);

const redis = new Redis(redisUrl);

// Ensure the consumer group exists so the processor can claim messages.
async function ensureGroup(): Promise<void> {
  try {
    await redis.xgroup('CREATE', streamKey, streamGroup, '$', 'MKSTREAM');
    logger.info({ streamKey, streamGroup }, 'stream_group_created');
  } catch (error) {
    if (error instanceof Error && error.message.includes('BUSYGROUP')) {
      logger.debug({ streamKey, streamGroup }, 'stream_group_exists');
      return;
    }
    throw error;
  }
}

// Convert Redis stream field arrays into a plain object for downstream processing.
function toFieldMap(fields: string[]): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (let index = 0; index < fields.length; index += 2) {
    mapped[fields[index]] = fields[index + 1];
  }
  return mapped;
}

// Coerces values into numbers, returning null when parsing fails.
function asNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Groups speeds into bands for lightweight enrichment downstream.
function computeSpeedBand(speedKph: number | null): string {
  if (speedKph === null) {
    return 'unknown';
  }
  if (speedKph < 5) {
    return 'idle';
  }
  if (speedKph < 30) {
    return 'low';
  }
  if (speedKph < 60) {
    return 'medium';
  }
  return 'high';
}

// Writes a single entry to an output stream with optional max length trimming.
async function writeStream(stream: string, fields: Record<string, string>): Promise<void> {
  const entries = Object.entries(fields).flat();
  if (outputMaxLen > 0) {
    await redis.xadd(stream, 'MAXLEN', '~', outputMaxLen, '*', ...entries);
    return;
  }
  await redis.xadd(stream, '*', ...entries);
}

// Handle a single stream entry with enrichment, scoring, and webhook fan-out.
async function handleEntry(entryId: string, fields: string[]): Promise<void> {
  const payload = toFieldMap(fields);
  logger.info({ entryId, streamKey, payloadKeys: Object.keys(payload) }, 'stream_entry_received');

  try {
    const kind = payload.kind ?? 'telemetry';
    if (kind === 'telemetry') {
      const speedKph = asNumber(payload.speedKph);
      const speedBand = computeSpeedBand(speedKph);
      const penalty =
        speedKph && speedKph >= 80 ? 3 : speedKph && speedKph >= 60 ? 2 : speedKph && speedKph >= 40 ? 1 : 0;

      await writeStream(enrichedStreamKey, {
        sourceEntryId: entryId,
        deviceId: payload.deviceId ?? '',
        fleetId: payload.fleetId ?? '',
        bikeId: payload.bikeId ?? '',
        ts: payload.ts ?? new Date().toISOString(),
        speedKph: payload.speedKph ?? '',
        speedBand,
      });

      await writeStream(scoreStreamKey, {
        sourceEntryId: entryId,
        deviceId: payload.deviceId ?? '',
        fleetId: payload.fleetId ?? '',
        bikeId: payload.bikeId ?? '',
        ts: payload.ts ?? new Date().toISOString(),
        scoreDelta: (-penalty).toString(),
      });
    }

    if (kind === 'event') {
      const eventType = payload.type ?? '';
      if (['CRASH', 'SOS', 'THEFT_SUSPECTED'].includes(eventType)) {
        await writeStream(webhookStreamKey, {
          sourceEntryId: entryId,
          fleetId: payload.fleetId ?? '',
          bikeId: payload.bikeId ?? '',
          deviceId: payload.deviceId ?? '',
          ts: payload.ts ?? new Date().toISOString(),
          type: eventType,
          severity: payload.severity ?? '',
          metaJson: payload.metaJson ?? '{}',
        });
      }
    }
  } catch (error) {
    logger.error({ err: error, entryId }, 'stream_entry_failed');
  } finally {
    await redis.xack(streamKey, streamGroup, entryId);
  }
}

// Poll the stream group continuously and dispatch entries for processing.
async function pollLoop(): Promise<void> {
  while (true) {
    const result = await redis.xreadgroup(
      'GROUP',
      streamGroup,
      streamConsumer,
      'BLOCK',
      pollMs,
      'COUNT',
      50,
      'STREAMS',
      streamKey,
      '>'
    );

    if (!result) {
      continue;
    }

    for (const [, entries] of result) {
      for (const [entryId, fields] of entries) {
        await handleEntry(entryId, fields as string[]);
      }
    }
  }
}

// Initialize the processor and begin stream consumption.
async function start(): Promise<void> {
  logger.info({ redisUrl, streamKey, streamGroup, streamConsumer }, 'stream_processor_starting');
  await ensureGroup();
  await pollLoop();
}

start().catch((error) => {
  logger.error({ err: error }, 'stream_processor_failed');
  process.exitCode = 1;
});

process.on('SIGINT', async () => {
  logger.info('stream_processor_shutdown');
  await redis.quit();
  process.exit(0);
});
