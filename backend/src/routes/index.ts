import { Router, type RequestHandler } from 'express';
import type { Container } from '../container.js';
import {
  authenticate,
  imageUpload,
  optionalAuth,
  requireCsrfHeader,
  requireRole,
  validate,
} from '../middlewares/index.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/auth.validator.js';
import {
  auctionIdSchema,
  cancelAuctionSchema,
  createAuctionSchema,
  listAuctionsSchema,
  listBidsSchema,
  placeBidSchema,
  updateAuctionSchema,
} from '../validators/auction.validator.js';
import {
  bikeIdSchema,
  bikeImageSchema,
  createBikeSchema,
  listBikesSchema,
  updateBikeSchema,
} from '../validators/bike.validator.js';
import {
  analyticsSchema,
  myAuctionsSchema,
  notificationIdSchema,
  notificationsSchema,
  watchlistSchema,
  winnersSchema,
} from '../validators/me.validator.js';

/**
 * All API routes. Routes only declare: path → middleware (auth, validation, limits) → controller.
 */
export function createApiRouter(c: Container): Router {
  const { controllers, tokens, rateLimiter } = c;
  const requireAuth = authenticate(tokens);
  const maybeAuth = optionalAuth(tokens);
  const adminOnly: RequestHandler[] = [requireAuth, requireRole('ADMIN')];

  // Brute-force protection: per IP+email for login, per IP for registration.
  const loginLimiter = rateLimiter.create({
    prefix: 'login',
    windowMs: 15 * 60_000,
    limit: 10,
    keyGenerator: (req) => {
      const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
      return `${req.ip}:${typeof email === 'string' ? email.toLowerCase() : ''}`;
    },
  });
  const registerLimiter = rateLimiter.create({ prefix: 'register', windowMs: 60 * 60_000, limit: 10 });
  const refreshLimiter = rateLimiter.create({ prefix: 'refresh', windowMs: 60_000, limit: 30 });
  // Bids: generous enough for a real bidding war, tight enough to stop scripted floods.
  const bidLimiter = rateLimiter.create({
    prefix: 'bid',
    windowMs: 10_000,
    limit: 10,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anonymous',
  });

  const router = Router();

  // ─── Auth ────────────────────────────────────────────────────────────────
  const auth = controllers.auth;
  router.post('/auth/register', registerLimiter, validate(registerSchema), auth.register);
  router.post('/auth/login', loginLimiter, validate(loginSchema), auth.login);
  router.post('/auth/refresh', refreshLimiter, requireCsrfHeader, auth.refresh);
  router.post('/auth/logout', requireCsrfHeader, auth.logout);
  router.get('/auth/me', requireAuth, auth.me);

  // ─── Auctions & bids ─────────────────────────────────────────────────────
  const auctions = controllers.auctions;
  router.get('/auctions', maybeAuth, validate(listAuctionsSchema), auctions.list);
  router.get('/auctions/brands', auctions.brands);
  router.get('/auctions/:id', maybeAuth, validate(auctionIdSchema), auctions.get);
  router.post('/auctions', ...adminOnly, validate(createAuctionSchema), auctions.create);
  router.patch('/auctions/:id', ...adminOnly, validate(updateAuctionSchema), auctions.update);
  router.delete('/auctions/:id', ...adminOnly, validate(auctionIdSchema), auctions.delete);
  router.post('/auctions/:id/publish', ...adminOnly, validate(auctionIdSchema), auctions.publish);
  router.post('/auctions/:id/unpublish', ...adminOnly, validate(auctionIdSchema), auctions.unpublish);
  router.post('/auctions/:id/start', ...adminOnly, validate(auctionIdSchema), auctions.start);
  router.post('/auctions/:id/end', ...adminOnly, validate(auctionIdSchema), auctions.end);
  router.post('/auctions/:id/cancel', ...adminOnly, validate(cancelAuctionSchema), auctions.cancel);
  router.post('/auctions/:id/watch', requireAuth, validate(auctionIdSchema), auctions.watch);
  router.delete('/auctions/:id/watch', requireAuth, validate(auctionIdSchema), auctions.unwatch);
  router.get('/auctions/:id/bids', maybeAuth, validate(listBidsSchema), auctions.listBids);
  router.post(
    '/auctions/:id/bids',
    requireAuth,
    requireRole('BUYER'),
    bidLimiter,
    validate(placeBidSchema),
    auctions.placeBid,
  );

  // ─── Bikes (admin) ───────────────────────────────────────────────────────
  const bikes = controllers.bikes;
  router.get('/bikes', ...adminOnly, validate(listBikesSchema), bikes.list);
  router.get('/bikes/:id', ...adminOnly, validate(bikeIdSchema), bikes.get);
  router.post('/bikes', ...adminOnly, validate(createBikeSchema), bikes.create);
  router.patch('/bikes/:id', ...adminOnly, validate(updateBikeSchema), bikes.update);
  router.delete('/bikes/:id', ...adminOnly, validate(bikeIdSchema), bikes.delete);
  router.post('/bikes/:id/images', ...adminOnly, validate(bikeIdSchema), imageUpload, bikes.uploadImages);
  router.delete('/bikes/:id/images/:imageId', ...adminOnly, validate(bikeImageSchema), bikes.deleteImage);

  // ─── Current user ────────────────────────────────────────────────────────
  const me = controllers.me;
  router.patch('/me', requireAuth, validate(updateProfileSchema), auth.updateProfile);
  router.get('/me/summary', requireAuth, me.summary);
  router.get('/me/auctions', requireAuth, validate(myAuctionsSchema), me.auctions);
  router.get('/me/watchlist', requireAuth, validate(watchlistSchema), me.watchlist);
  router.get('/me/notifications', requireAuth, validate(notificationsSchema), me.listNotifications);
  router.post('/me/notifications/read-all', requireAuth, me.readAllNotifications);
  router.post('/me/notifications/:id/read', requireAuth, validate(notificationIdSchema), me.readNotification);

  // ─── Admin ───────────────────────────────────────────────────────────────
  const admin = controllers.admin;
  router.get('/admin/dashboard', ...adminOnly, admin.dashboard);
  router.get('/admin/analytics', ...adminOnly, validate(analyticsSchema), admin.analytics);
  router.get('/admin/winners', ...adminOnly, validate(winnersSchema), admin.winners);

  return router;
}

export function createHealthRouter(c: Container): Router {
  const router = Router();
  router.get('/', c.controllers.health.report);
  router.get('/live', c.controllers.health.live);
  router.get('/ready', c.controllers.health.report);
  return router;
}
