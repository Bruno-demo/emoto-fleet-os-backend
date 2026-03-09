import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  REDIS_IN_MEMORY: booleanString,
  MQTT_URL: z.string().url(),
  MQTT_DISABLED: booleanString,
  NOTIFICATION_OUTBOX_INLINE: booleanString,
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('emoto-evidence'),
  S3_ACCESS_KEY_ID: z.string().min(3).default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().min(6).default('minioadmin'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  S3_PRESIGN_EXPIRES_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(600),
  DEVICE_SECRET_MASTER_KEY: z
    .string()
    .min(32)
    .default('change_me_device_secret_master_key_32chars'),
  COMMAND_TTL_SECONDS: z.coerce.number().int().min(10).max(600).default(45),
  INCIDENT_CRASH_MIN_SEVERITY: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .default('HIGH'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().min(2),
  PARTNER_JWT_SECRET: z.string().min(16),
  PARTNER_JWT_EXPIRES_IN: z.string().min(2).default('1h'),
  PARTNER_WEBHOOK_SECRET_MASTER_KEY: z
    .string()
    .min(32)
    .default('change_me_partner_webhook_secret_master_key_32chars'),
  AUTH_REGISTER_ENABLED: booleanString,
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  TRIP_START_SPEED_KPH: z.coerce.number().positive().default(5),
  TRIP_END_SPEED_KPH: z.coerce.number().positive().default(5),
  TRIP_START_MOVEMENT_SECONDS: z.coerce.number().int().positive().default(30),
  TRIP_END_IDLE_SECONDS: z.coerce.number().int().positive().default(300),
  TRIP_SCORE_MIN_DISTANCE_KM: z.coerce.number().positive().default(1),
  TRIP_SCORE_PENALTY_MULTIPLIER: z.coerce.number().positive().default(20),
  TRIP_SCORE_WEIGHT_OVERSPEED: z.coerce.number().nonnegative().default(1.2),
  TRIP_SCORE_WEIGHT_HARSH_BRAKE: z.coerce.number().nonnegative().default(1),
  TRIP_SCORE_WEIGHT_HARSH_ACCEL: z.coerce.number().nonnegative().default(0.8),
  TRIP_SCORE_WEIGHT_HARSH_CORNER: z.coerce.number().nonnegative().default(0.8),
  TRIP_SCORE_WEIGHT_CRASH: z.coerce.number().nonnegative().default(4),
  TRIP_SCORE_WEIGHT_THEFT_SUSPECTED: z.coerce.number().nonnegative().default(3),
});

export type Env = z.infer<typeof envSchema>;
