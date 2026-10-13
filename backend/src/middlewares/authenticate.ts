import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@prisma/client';
import type { TokenService } from '../services/token.service.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Rejects the request unless it carries a valid access token. */
export function authenticate(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) throw new AuthenticationError();
    req.user = tokens.verifyAccessToken(token);
    next();
  };
}

/**
 * Attaches the user when a valid token is present but never rejects. Used on public endpoints
 * that personalise their response (e.g. `isWatching` on auction detail).
 */
export function optionalAuth(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (token) {
      try {
        req.user = tokens.verifyAccessToken(token);
      } catch {
        // An expired token on a public endpoint is not an error — treat as anonymous.
      }
    }
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AuthenticationError();
    if (!roles.includes(req.user.role)) throw new AuthorizationError();
    next();
  };
}

/** Narrowing helper for controllers behind `authenticate`. */
export function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new AuthenticationError();
  return req.user;
}
