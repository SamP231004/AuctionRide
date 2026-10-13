import type { Response } from 'express';

/** Every successful JSON response uses this envelope (see docs/ARCHITECTURE.md §3.4). */
export interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: object;
}

export interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: object } = {},
): void {
  const body: SuccessBody<T> = { success: true, data };
  if (options.meta) body.meta = options.meta;
  res.status(options.status ?? 200).json(body);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, { status: 201 });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
