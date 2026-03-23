import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const redisUrl = process.env.STREAM_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
const streamKey = process.env.STREAM_KEY ?? 'telemetry:stream';
const streamGroup = process.env.STREAM_GROUP ?? 'telemetry-processors';
const streamConsumer = process.env.STREAM_CONSUMER ?? `processor-${process.pid}`;
const pollMs = Number(process.env.STREAM_POLL_MS ?? 1000);

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

// Handle a single stream entry with a placeholder pipeline step.
async function handleEntry(entryId: string, fields: string[]): Promise<void> {
  const payload = toFieldMap(fields);
  logger.info({ entryId, streamKey, payloadKeys: Object.keys(payload) }, 'stream_entry_received');

  // Placeholder for enrichment, scoring, and external integrations.
  await redis.xack(streamKey, streamGroup, entryId);
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
