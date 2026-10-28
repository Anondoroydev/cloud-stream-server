import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REPOSITORY_URL: z.string().url().default('https://raw.githubusercontent.com/phisher98/CXXX/builds/CXXX.json'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`);
}

export const config = {
  ...parsedEnv.data,
  corsOrigins: parsedEnv.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  cacheTtlMs: parsedEnv.data.CACHE_TTL_SECONDS * 1000,
};
