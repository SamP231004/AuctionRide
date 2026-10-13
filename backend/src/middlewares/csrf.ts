import type { NextFunction, Request, Response } from 'express';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '../config/constants.js';
import { AuthorizationError } from '../utils/errors.js';

/**
 * Cookie-authenticated endpoints (refresh, logout) require a custom header. Browsers cannot attach
 * custom headers cross-origin without a CORS preflight, and the preflight only succeeds for
 * allowlisted origins — so a malicious site cannot drive these endpoints with the victim's cookie.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction): void {
  if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    throw new AuthorizationError('Missing or invalid request header', 'CSRF_HEADER_MISSING');
  }
  next();
}
