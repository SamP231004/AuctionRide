import type { CookieOptions } from 'express';
import { REFRESH_COOKIE_PATH } from './constants.js';
import { cookieSecure, env } from './env.js';

/** Refresh-token cookie: HttpOnly, scoped to the auth routes only. */
export function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: env.COOKIE_SAME_SITE,
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function clearRefreshCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...rest } = refreshCookieOptions(0);
  return rest;
}
