import { z } from 'zod';

/**
 * Single place where process.env is read. The process refuses to start with an invalid
 * configuration — failing fast at boot is far cheaper than failing on the first request.
 */

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const durationString = z
  .string()
  .regex(/^\d+[smhd]$/, 'Expected a duration such as 15m, 1h or 7d');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_VERSION: z.string().default(process.env.npm_package_version ?? '1.0.0'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: durationString.default('15m'),
  JWT_ISSUER: z.string().default('auctionride-api'),
  JWT_AUDIENCE: z.string().default('auctionride-web'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: booleanString.optional(),
  COOKIE_DOMAIN: z.string().optional(),

  SOFT_CLOSE_WINDOW_SECONDS: z.coerce.number().int().min(0).default(60),
  SOFT_CLOSE_EXTENSION_SECONDS: z.coerce.number().int().min(0).default(60),
  MAX_SOFT_CLOSE_EXTENSIONS: z.coerce.number().int().min(0).default(10),
  ARCHIVE_AFTER_HOURS: z.coerce.number().int().min(1).default(168),

  RUN_WORKERS: booleanString.default('true'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(25).default(5),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // The logger depends on env, so this is the one place we write to stderr directly.
    process.stderr.write(`\n❌ Invalid environment configuration:\n${issues}\n\n`);
    process.exit(1);
  }

  const env = parsed.data;
  if (env.COOKIE_SAME_SITE === 'none' && env.COOKIE_SECURE === false) {
    process.stderr.write('\n❌ COOKIE_SAME_SITE=none requires COOKIE_SECURE=true\n\n');
    process.exit(1);
  }
  return env;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Secure cookies default to on in production; can be forced off for plain-HTTP local stacks. */
export const cookieSecure = env.COOKIE_SECURE ?? isProduction;
