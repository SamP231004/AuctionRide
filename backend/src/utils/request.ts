import type { Request } from 'express';
import type { RequestContext } from '../services/audit.service.js';
import type { Viewer } from '../services/mappers.js';

/** Request metadata recorded in the audit log. */
export function requestContext(req: Request): RequestContext {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}

export function viewerOf(req: Request): Viewer | undefined {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

/** Correlation id assigned by the request logger. */
export function requestIdOf(req: Request): string | undefined {
  return typeof req.id === 'string' ? req.id : undefined;
}
