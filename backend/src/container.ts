import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { env } from './config/env.js';
import { AdminController, HealthController } from './controllers/admin.controller.js';
import { AuctionController } from './controllers/auction.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { BikeController } from './controllers/bike.controller.js';
import { MeController } from './controllers/me.controller.js';
import { createRateLimiterFactory, type RateLimiterFactory } from './middlewares/index.js';
import { AnalyticsRepository } from './repositories/analytics.repository.js';
import { AuctionRepository } from './repositories/auction.repository.js';
import { AuditLogRepository } from './repositories/audit-log.repository.js';
import { BidRepository } from './repositories/bid.repository.js';
import { BikeRepository } from './repositories/bike.repository.js';
import { NotificationRepository } from './repositories/notification.repository.js';
import { RefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { createTransactionManager } from './repositories/types.js';
import { UserRepository } from './repositories/user.repository.js';
import { WatchlistRepository } from './repositories/watchlist.repository.js';
import { AdminService } from './services/admin.service.js';
import { AuctionLifecycleService } from './services/auction-lifecycle.service.js';
import { AuctionService } from './services/auction.service.js';
import { AuditService } from './services/audit.service.js';
import { AuthService } from './services/auth.service.js';
import { BidService } from './services/bid.service.js';
import { BikeService } from './services/bike.service.js';
import { HealthService } from './services/health.service.js';
import { MeService } from './services/me.service.js';
import { NotificationService } from './services/notification.service.js';
import { LocalStorageProvider } from './services/storage.service.js';
import { TokenService } from './services/token.service.js';
import { NoopPublisher } from './socket/index.js';
import type { AuctionScheduler, Cache, RealtimePublisher, StorageProvider } from './types/ports.js';
import { NoopCache, RedisCache } from './utils/cache.js';
import { systemClock, type Clock } from './utils/time.js';

export interface ContainerDeps {
  db: PrismaClient;
  scheduler: AuctionScheduler;
  /** Omit in tests to use in-memory rate limiting and no cache. */
  redis?: Redis;
  realtime?: RealtimePublisher;
  storage?: StorageProvider;
  cache?: Cache;
  clock?: Clock;
  rateLimiting?: boolean;
}

/**
 * Composition root. Wires repositories → services → controllers with plain constructor injection.
 * The realtime publisher is a mutable slot because the Socket.IO server is created after the
 * HTTP server, which in turn needs the app built from this container.
 */
export function createContainer(deps: ContainerDeps) {
  const { db, scheduler } = deps;
  const clock = deps.clock ?? systemClock;
  const realtimeSlot: { current: RealtimePublisher } = { current: deps.realtime ?? new NoopPublisher() };
  const realtime: RealtimePublisher = {
    bidPlaced: (payload) => realtimeSlot.current.bidPlaced(payload),
    auctionUpdated: (payload) => realtimeSlot.current.auctionUpdated(payload),
    notify: (userId, notification) => realtimeSlot.current.notify(userId, notification),
  };

  const repos = {
    users: new UserRepository(db),
    refreshTokens: new RefreshTokenRepository(db),
    bikes: new BikeRepository(db),
    auctions: new AuctionRepository(db),
    bids: new BidRepository(db),
    watchlist: new WatchlistRepository(db),
    notifications: new NotificationRepository(db),
    auditLogs: new AuditLogRepository(db),
    analytics: new AnalyticsRepository(db),
  };
  const tx = createTransactionManager(db);

  const tokens = new TokenService({
    secret: env.JWT_ACCESS_SECRET,
    ttl: env.JWT_ACCESS_TTL,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  const audit = new AuditService(repos.auditLogs);
  const notifications = new NotificationService(repos.notifications, realtime, clock);
  const storage = deps.storage ?? new LocalStorageProvider(env.UPLOAD_DIR, env.PUBLIC_API_URL);
  const cache = deps.cache ?? (deps.redis ? new RedisCache(deps.redis) : new NoopCache());

  const services = {
    auth: new AuthService(repos.users, repos.refreshTokens, tx, tokens, audit, clock, {
      bcryptRounds: env.BCRYPT_ROUNDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    }),
    bikes: new BikeService(repos.bikes, storage, audit),
    auctions: new AuctionService(repos.auctions, repos.bikes, repos.watchlist, scheduler, audit, clock),
    lifecycle: new AuctionLifecycleService(
      repos.auctions,
      repos.bids,
      repos.watchlist,
      tx,
      scheduler,
      realtime,
      notifications,
      audit,
      clock,
      { archiveAfterHours: env.ARCHIVE_AFTER_HOURS },
    ),
    bids: new BidService(repos.auctions, repos.bids, tx, scheduler, realtime, notifications, clock, {
      windowSeconds: env.SOFT_CLOSE_WINDOW_SECONDS,
      extensionSeconds: env.SOFT_CLOSE_EXTENSION_SECONDS,
      maxExtensions: env.MAX_SOFT_CLOSE_EXTENSIONS,
    }),
    me: new MeService(repos.auctions, repos.bids, repos.watchlist, repos.notifications),
    admin: new AdminService(repos.auctions, repos.bids, repos.users, repos.analytics, cache, clock),
    notifications,
    health: new HealthService(db, deps.redis, env.APP_VERSION),
  };

  const controllers = {
    auth: new AuthController(services.auth),
    auctions: new AuctionController(services.auctions, services.lifecycle, services.bids),
    bikes: new BikeController(services.bikes),
    me: new MeController(services.me, services.notifications),
    admin: new AdminController(services.admin),
    health: new HealthController(services.health),
  };

  const rateLimiter: RateLimiterFactory = createRateLimiterFactory(deps.redis, {
    enabled: deps.rateLimiting ?? true,
  });

  return {
    repos,
    services,
    controllers,
    tokens,
    rateLimiter,
    setRealtimePublisher(publisher: RealtimePublisher) {
      realtimeSlot.current = publisher;
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
