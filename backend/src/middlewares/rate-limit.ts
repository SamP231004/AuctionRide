import type { Request, RequestHandler } from 'express';
import { rateLimit, type Store } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import { requestIdOf } from '../utils/request.js';
import type { ErrorBody } from '../utils/response.js';

export interface RateLimitPolicy {
  windowMs: number;
  limit: number;
  /** Namespaces the counters in Redis so policies do not share buckets. */
  prefix: string;
  keyGenerator?: (req: Request) => string;
}

export interface RateLimiterFactory {
  create(policy: RateLimitPolicy): RequestHandler;
}

/**
 * Builds rate limiters backed by Redis so limits are global across API replicas.
 * When no Redis client is supplied (unit/integration tests), an in-memory store is used.
 */
export function createRateLimiterFactory(redis?: Redis, { enabled = true } = {}): RateLimiterFactory {
  const makeStore = (prefix: string): Store | undefined =>
    redis
      ? new RedisStore({
          prefix: `rl:${prefix}:`,
          sendCommand: (command: string, ...args: string[]) =>
            redis.call(command, ...args) as Promise<RedisReply>,
        })
      : undefined;

  return {
    create(policy) {
      if (!enabled) return (_req, _res, next) => next();
      return rateLimit({
        windowMs: policy.windowMs,
        limit: policy.limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        store: makeStore(policy.prefix),
        ...(policy.keyGenerator ? { keyGenerator: policy.keyGenerator } : {}),
        handler: (req, res) => {
          const body: ErrorBody = {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please wait a moment and try again.',
              requestId: requestIdOf(req),
            },
          };
          res.status(429).json(body);
        },
      });
    },
  };
}
