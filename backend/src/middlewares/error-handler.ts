import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import {
  AppError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { requestIdOf } from '../utils/request.js';
import type { ErrorBody } from '../utils/response.js';

/** Converts zod issues into a compact, client-friendly shape: [{ path: 'body.email', message }]. */
function formatZodIssues(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/** Normalises any thrown value into an AppError. Unknown errors become a generic 500. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new ValidationError('Some fields are invalid', formatZodIssues(error));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new ConflictError('A record with these details already exists', 'DUPLICATE');
      case 'P2025':
        return new NotFoundError();
      case 'P2003':
        return new ConflictError('Related record constraint failed', 'FOREIGN_KEY_CONSTRAINT');
      default:
        return new InternalServerError();
    }
  }

  if (error instanceof multer.MulterError) {
    const messages: Partial<Record<multer.ErrorCode, string>> = {
      LIMIT_FILE_SIZE: 'One of the files is too large',
      LIMIT_FILE_COUNT: 'Too many files',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    return new ValidationError(messages[error.code] ?? 'Invalid upload', undefined, `UPLOAD_${error.code}`);
  }

  // body-parser errors carry an HTTP status and a `type`.
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const type = error.type;
    if (type === 'entity.parse.failed') return new ValidationError('Malformed JSON body', undefined, 'INVALID_JSON');
    if (type === 'entity.too.large') return new ValidationError('Request body too large', undefined, 'PAYLOAD_TOO_LARGE');
  }

  // http-errors from Express internals (e.g. express.static for a missing upload).
  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
    return new NotFoundError('File');
  }

  return new InternalServerError();
}

/**
 * Centralised error middleware. Responsibilities:
 *  - map every error to the standard envelope
 *  - log server faults with full context (stack included) but never send stacks to clients
 */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const appError = toAppError(error);
  const log = req.log ?? logger;

  if (appError.statusCode >= 500) {
    log.error({ err: error, code: appError.code }, 'Unhandled error while processing request');
  } else {
    log.info({ code: appError.code, status: appError.statusCode }, appError.message);
  }

  if (res.headersSent) return;

  const body: ErrorBody = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
      requestId: requestIdOf(req),
    },
  };
  res.status(appError.statusCode).json(body);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
}
