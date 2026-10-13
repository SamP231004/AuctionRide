/**
 * Typed application errors. Services throw these; the error middleware maps them to HTTP.
 * `code` is a stable, machine-readable identifier that clients may branch on.
 * `message` must always be safe to show to an end user.
 */

export type ErrorDetails = Record<string, unknown> | unknown[];

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetails;
  /** Operational errors are expected (bad input, not found). Non-operational ones are bugs. */
  readonly isOperational: boolean = true;

  protected constructor(message: string, code: string, details?: ErrorDetails) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  constructor(message = 'Validation failed', details?: ErrorDetails, code = 'VALIDATION_ERROR') {
    super(message, code, details);
  }
}

/** A well-formed request that violates a business rule (e.g. bid below minimum). */
export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  constructor(code: string, message: string, details?: ErrorDetails) {
    super(message, code, details);
  }
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  constructor(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    super(message, code);
  }
}

export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  constructor(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    super(message, code);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  constructor(resource = 'Resource', code = 'NOT_FOUND') {
    super(`${resource} not found`, code);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  constructor(message: string, code = 'CONFLICT', details?: ErrorDetails) {
    super(message, code, details);
  }
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  constructor(message = 'Too many requests, please slow down') {
    super(message, 'RATE_LIMITED');
  }
}

export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  constructor(message = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE');
  }
}

export class InternalServerError extends AppError {
  readonly statusCode = 500;
  override readonly isOperational = false;
  constructor(message = 'Something went wrong. Please try again.') {
    super(message, 'INTERNAL_ERROR');
  }
}
