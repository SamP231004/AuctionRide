import type { CorsOptions } from 'cors';
import { env } from './env.js';

/** Explicit allowlist; credentials are only ever shared with these origins. */
export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Same-origin / server-to-server requests have no Origin header.
    if (!origin || env.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  maxAge: 600,
};
