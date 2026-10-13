/**
 * Runs before every test file (and before any src module reads env).
 * Integration tests use a dedicated database so they never touch development data.
 */
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://auctionride:auctionride@localhost:5433/auctionride_test?schema=public';

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: testDatabaseUrl,
  DIRECT_URL: testDatabaseUrl,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'test-secret-that-is-definitely-longer-than-32-characters',
  BCRYPT_ROUNDS: '4',
  SOFT_CLOSE_WINDOW_SECONDS: '60',
  SOFT_CLOSE_EXTENSION_SECONDS: '60',
  MAX_SOFT_CLOSE_EXTENSIONS: '3',
  RUN_WORKERS: 'false',
  UPLOAD_DIR: './uploads-test',
});
