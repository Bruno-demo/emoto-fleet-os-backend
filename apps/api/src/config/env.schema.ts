import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const booleanStringDefaultTrue = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

// Rejects known placeholder values that must not reach production.
const noPlaceholderSecret = (val: string, ctx: z.RefinementCtx) => {
  if (val.startsWith('change_me')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Secret must not use the default placeholder value',
    });
  }
};

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PUBLIC_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  REDIS_IN_MEMORY: booleanString,
  MQTT_URL: z.string().url(),
  MQTT_DISABLED: booleanString,
  SINOTRACK_ENABLED: booleanStringDefaultTrue,
  SINOTRACK_PORT: z.coerce.number().int().positive().default(5013),
  NOTIFICATION_OUTBOX_INLINE: booleanString,
  OVERPASS_API_URL: z.string().url().default('https://overpass-api.de/api/interpreter'),
  ROAD_FEATURE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  ROAD_FEATURE_REFRESH_SECONDS: z.coerce.number().int().positive().default(86_400),
  ROAD_FEATURE_MAX_RESULTS: z.coerce.number().int().positive().default(600),
  ROAD_SPEED_LIMIT_RADIUS_METERS: z.coerce.number().int().positive().default(80),
  ROAD_SAFETY_RADIUS_METERS: z.coerce.number().int().positive().default(200),
  ROAD_SPEED_TOLERANCE_KPH: z.coerce.number().int().positive().default(5),
  ROAD_SCHOOL_SPEED_KPH: z.coerce.number().int().positive().default(30),
  ROAD_HOSPITAL_SPEED_KPH: z.coerce.number().int().positive().default(30),
  ROAD_MARKET_SPEED_KPH: z.coerce.number().int().positive().default(25),
  STREAM_ENABLED: booleanStringDefaultTrue,
  STREAM_KEY: z.string().default('telemetry:stream'),
  STREAM_RULES_KEY: z.string().default('rules:stream'),
  STREAM_TRIPS_KEY: z.string().default('trips:stream'),
  STREAM_WEBHOOK_KEY: z.string().default('webhooks:outbox'),
  STREAM_MAX_LEN: z.coerce.number().int().positive().default(10000),
  STREAM_OUTPUT_MAX_LEN: z.coerce.number().int().positive().default(10000),
  WEBHOOK_STREAM_GROUP: z.string().default('webhook-dispatchers'),
  WEBHOOK_STREAM_POLL_MS: z.coerce.number().int().positive().default(1000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_PRETTY: booleanString,
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('emoto-evidence'),
  S3_ACCESS_KEY_ID: z.string().min(3),
  S3_SECRET_ACCESS_KEY: z.string().min(6),
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
    .superRefine(noPlaceholderSecret),
  COMMAND_TTL_SECONDS: z.coerce.number().int().min(10).max(600).default(45),
  INCIDENT_CRASH_MIN_SEVERITY: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .default('HIGH'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(2),
  PARTNER_JWT_SECRET: z.string().min(32),
  PARTNER_JWT_EXPIRES_IN: z.string().min(2).default('1h'),
  PARTNER_WEBHOOK_SECRET_MASTER_KEY: z
    .string()
    .min(32)
    .superRefine(noPlaceholderSecret),
  AUTH_REGISTER_ENABLED: booleanString,
  AUTH_PUBLIC_REGISTER_ENABLED: booleanString,
  AUTH_COOKIE_NAME: z.string().min(3).default('emoto_access_token'),
  AUTH_COOKIE_SECURE: booleanString,
  AUTH_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_REMEMBER_ME_EXPIRES_IN: z.string().min(2).default('30d'),
  AUTH_REMEMBER_ME_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  INVITE_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(48),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  TRIP_START_SPEED_KPH: z.coerce.number().positive().default(5),
  TRIP_END_SPEED_KPH: z.coerce.number().positive().default(5),
  TRIP_START_MOVEMENT_SECONDS: z.coerce.number().int().positive().default(30),
  TRIP_END_IDLE_SECONDS: z.coerce.number().int().positive().default(300),
  TRIP_SCORE_MIN_DISTANCE_KM: z.coerce.number().positive().default(1),
  TRIP_SCORE_PENALTY_MULTIPLIER: z.coerce.number().positive().default(20),
  TRIP_SCORE_WEIGHT_OVERSPEED: z.coerce.number().nonnegative().default(1.2),
  TRIP_SCORE_WEIGHT_SPEED_LIMIT: z.coerce.number().nonnegative().default(1.1),
  TRIP_SCORE_WEIGHT_SCHOOL_ZONE: z.coerce.number().nonnegative().default(1.4),
  TRIP_SCORE_WEIGHT_HOSPITAL_ZONE: z.coerce.number().nonnegative().default(1.2),
  TRIP_SCORE_WEIGHT_MARKET_ZONE: z.coerce.number().nonnegative().default(1.2),
  TRIP_SCORE_WEIGHT_HARSH_BRAKE: z.coerce.number().nonnegative().default(1),
  TRIP_SCORE_WEIGHT_HARSH_ACCEL: z.coerce.number().nonnegative().default(0.8),
  TRIP_SCORE_WEIGHT_HARSH_CORNER: z.coerce.number().nonnegative().default(0.8),
  TRIP_SCORE_WEIGHT_CRASH: z.coerce.number().nonnegative().default(4),
  TRIP_SCORE_WEIGHT_THEFT_SUSPECTED: z.coerce.number().nonnegative().default(3),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production') {
    if (!env.CORS_ORIGINS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS is required in production',
      });
    }
    if (env.REDIS_IN_MEMORY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_IN_MEMORY'],
        message: 'In-memory Redis must not be used in production',
      });
    }
    if (env.LOG_PRETTY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LOG_PRETTY'],
        message: 'LOG_PRETTY must not be enabled in production',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;
