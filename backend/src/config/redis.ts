import { Redis, type RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Factory for Redis connections. Separate connections are used for different roles because
 * subscriber connections cannot issue regular commands and BullMQ workers block on reads.
 *
 * @param name           label used in logs
 * @param forBlocking    BullMQ workers require `maxRetriesPerRequest: null`
 */
export function createRedisClient(name: string, { forBlocking = false } = {}): Redis {
  const options: RedisOptions = {
    connectionName: `auctionride:${name}`,
    maxRetriesPerRequest: forBlocking ? null : 3,
    enableReadyCheck: true,
    // Exponential backoff capped at 5s; never give up — the health check reports the outage.
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    lazyConnect: false,
  };

  const client = new Redis(env.REDIS_URL, options);
  client.on('error', (error: Error) => logger.error({ err: error, redis: name }, 'Redis connection error'));
  client.on('ready', () => logger.debug({ redis: name }, 'Redis connection ready'));
  return client;
}
