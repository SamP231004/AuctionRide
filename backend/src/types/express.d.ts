import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` / `optionalAuth` middleware. */
      user?: AuthUser;
      /** Validated + transformed input, populated by the `validate` middleware. */
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}
