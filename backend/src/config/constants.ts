/** Application-wide constants that are not environment specific. */

export const API_PREFIX = '/api';

export const REFRESH_COOKIE_NAME = 'ar_rt';
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

/** Required on cookie-authenticated endpoints; forces a CORS preflight (CSRF mitigation). */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const BID_LIMITS = {
  /** Upper bound on a single bid (₹10 crore) — guards against typos and overflow abuse. */
  MAX_AMOUNT: 100_000_000,
} as const;

export const UPLOADS = {
  MAX_FILES_PER_REQUEST: 8,
  MAX_IMAGES_PER_BIKE: 12,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  PUBLIC_PATH: '/uploads',
} as const;

export const SOCKET = {
  MAX_AUCTION_ROOMS_PER_SOCKET: 20,
  rooms: {
    auction: (auctionId: string) => `auction:${auctionId}`,
    user: (userId: string) => `user:${userId}`,
    auctionsFeed: 'auctions',
  },
} as const;

export const CACHE_TTL_SECONDS = {
  ADMIN_ANALYTICS: 60,
  BRANDS: 300,
} as const;
