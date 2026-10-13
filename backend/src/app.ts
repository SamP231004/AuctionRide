import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { API_PREFIX, UPLOADS } from './config/constants.js';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import type { Container } from './container.js';
import { errorHandler, notFoundHandler, requestLogger } from './middlewares/index.js';
import { createApiRouter, createHealthRouter } from './routes/index.js';

/**
 * Builds the Express application without binding a port, so the exact same app is used by the
 * HTTP server and by the integration tests.
 */
export function createApp(container: Container): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);
  app.use(
    helmet({
      // The API serves JSON and images only; images are embedded cross-origin by the frontend.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/health', createHealthRouter(container));

  app.use(
    UPLOADS.PUBLIC_PATH,
    express.static(path.resolve(env.UPLOAD_DIR), {
      fallthrough: false,
      immutable: true,
      maxAge: '30d',
      dotfiles: 'deny',
      index: false,
    }),
  );

  const globalLimiter = container.rateLimiter.create({ prefix: 'global', windowMs: 60_000, limit: 300 });
  app.use(API_PREFIX, globalLimiter, createApiRouter(container));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
