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
  MQTT_URL: z.string().url(),
  DEVICE_SECRET_MASTER_KEY: z
    .string()
    .min(32)
    .default('change_me_device_secret_master_key_32chars'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().min(2),
  AUTH_REGISTER_ENABLED: booleanString,
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
});

export type Env = z.infer<typeof envSchema>;
