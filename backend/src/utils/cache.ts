import type { Redis } from 'ioredis';
import type { Cache } from '../types/ports.js';
import { logger } from './logger.js';

/** JSON cache over Redis. A cache failure degrades to a miss — it never fails the request. */
export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      logger.warn({ err: error, key }, 'Cache read failed');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      logger.warn({ err: error, key }, 'Cache write failed');
    }
  }
}

export class NoopCache implements Cache {
  get<T>(): Promise<T | null> {
    return Promise.resolve(null);
  }
  set(): Promise<void> {
    return Promise.resolve();
  }
}
