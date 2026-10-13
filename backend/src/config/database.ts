import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const SLOW_QUERY_MS = 250;

/**
 * Creates the Prisma client with logs routed into pino.
 * Connection pooling is configured through the connection string (`connection_limit`,
 * `pool_timeout`, and `pgbouncer=true` for Neon's pooled endpoint).
 */
export function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });

  client.$on('query', (event) => {
    if (event.duration >= SLOW_QUERY_MS) {
      logger.warn({ durationMs: event.duration, query: event.query }, 'Slow database query');
    }
  });
  client.$on('warn', (event) => logger.warn({ target: event.target }, event.message));
  client.$on('error', (event) => logger.error({ target: event.target }, event.message));

  return client;
}

export type Database = PrismaClient;
