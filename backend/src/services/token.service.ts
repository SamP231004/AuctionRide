import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import type { AuthUser } from '../types/express.js';
import { AuthenticationError } from '../utils/errors.js';
import { durationToMs } from '../utils/time.js';

export interface TokenConfig {
  secret: string;
  ttl: string;
  issuer: string;
  audience: string;
}

/** Signs and verifies short-lived access tokens (HS256). */
export class TokenService {
  readonly accessTtlMs: number;

  constructor(private readonly config: TokenConfig) {
    this.accessTtlMs = durationToMs(config.ttl);
  }

  signAccessToken(user: AuthUser): string {
    return jwt.sign({ role: user.role }, this.config.secret, {
      subject: user.id,
      algorithm: 'HS256',
      expiresIn: Math.floor(this.accessTtlMs / 1000),
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  verifyAccessToken(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: ['HS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as jwt.JwtPayload & { role?: Role };
      if (!payload.sub || (payload.role !== 'ADMIN' && payload.role !== 'BUYER')) {
        throw new AuthenticationError('Invalid access token', 'TOKEN_INVALID');
      }
      return { id: payload.sub, role: payload.role };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Session expired', 'TOKEN_EXPIRED');
      }
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError('Invalid access token', 'TOKEN_INVALID');
    }
  }
}
