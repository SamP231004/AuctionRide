import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createPrismaClient } from './config/database.js';
import { env } from './config/env.js';
import { createRedisClient } from './config/redis.js';
import { createContainer } from './container.js';
import { BullMqAuctionScheduler, createAuctionWorker } from './jobs/auction.jobs.js';
import { createSocketServer, SocketIoPublisher } from './socket/index.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const db = createPrismaClient();
  await db.$connect();

  const redis = createRedisClient('main');
  const queueConnection = createRedisClient('queue', { forBlocking: true });
  const pubClient = createRedisClient('socket-pub');
  const subClient = pubClient.duplicate();

  const scheduler = new BullMqAuctionScheduler(queueConnection);
  const container = createContainer({ db, redis, scheduler });
  const app = createApp(container);
  const httpServer = createServer(app);

  const io = createSocketServer(httpServer, { tokens: container.tokens, pubClient, subClient });
  container.setRealtimePublisher(new SocketIoPublisher(io));

  // Workers run in-process by default; set RUN_WORKERS=false on API replicas once a
  // dedicated worker deployment exists (same image, same code).
  const worker = env.RUN_WORKERS
    ? createAuctionWorker(
        queueConnection.duplicate(),
        { lifecycle: container.services.lifecycle, refreshTokens: container.repos.refreshTokens },
        env.WORKER_CONCURRENCY,
      )
    : null;
  if (worker) await scheduler.registerMaintenanceJobs();

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, workers: Boolean(worker), env: env.NODE_ENV }, 'AuctionRide API listening');
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    // Hard deadline in case something hangs.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000).unref();

    try {
      // Stop accepting new connections, let in-flight requests and jobs finish.
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await worker?.close();
      await scheduler.close();
      await db.$disconnect();
      await Promise.allSettled([redis.quit(), queueConnection.quit(), pubClient.quit(), subClient.quit()]);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception — exiting');
  process.exit(1);
});

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
