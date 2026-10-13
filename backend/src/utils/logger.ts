import pino from 'pino';
import { env, isProduction } from '../config/env.js';

/**
 * Structured JSON logger. In development logs are pretty-printed; in production they are emitted
 * as newline-delimited JSON for ingestion by any log pipeline (Loki, Datadog, CloudWatch, ...).
 *
 * Sensitive fields are redacted at the serializer level so they can never leak through
 * an accidental `logger.info({ req })` call.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'auctionride-api', version: env.APP_VERSION },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(isProduction || env.NODE_ENV === 'test'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service,version' },
        },
      }),
});

export type Logger = typeof logger;
