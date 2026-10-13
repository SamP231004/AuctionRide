import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import type { TransactionManager } from '../repositories/types.js';
import type { UserRepository } from '../repositories/user.repository.js';
import { AuthenticationError, ConflictError, NotFoundError } from '../utils/errors.js';
import { generateOpaqueToken, sha256 } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { addDays, type Clock } from '../utils/time.js';
import type { AuditService, RequestContext } from './audit.service.js';
import { toUserDto, type UserDto } from './mappers.js';
import type { TokenService } from './token.service.js';

export interface Session {
  user: UserDto;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthConfig {
  bcryptRounds: number;
  refreshTtlDays: number;
}

export class AuthService {
  /** Compared against when the email is unknown, so response time does not reveal which emails exist. */
  private readonly dummyHash: string;

  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tx: TransactionManager,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly config: AuthConfig,
  ) {
    this.dummyHash = bcrypt.hashSync('timing-attack-dummy-password', config.bcryptRounds);
  }

  async register(input: { name: string; email: string; password: string }, ctx: RequestContext): Promise<Session> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
    }
    const passwordHash = await bcrypt.hash(input.password, this.config.bcryptRounds);
    const user = await this.users.create({ name: input.name, email: input.email, passwordHash, role: 'BUYER' });

    logger.info({ userId: user.id }, 'User registered');
    await this.audit.record({ actorId: user.id, action: 'auth.register', entityType: 'user', entityId: user.id, context: ctx });
    return this.startSession(user, randomUUID(), ctx);
  }

  async login(input: { email: string; password: string }, ctx: RequestContext): Promise<Session> {
    const user = await this.users.findByEmail(input.email);
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? this.dummyHash);

    if (!user || !valid) {
      logger.warn({ email: input.email, ip: ctx.ip }, 'Failed login attempt');
      await this.audit.record({ actorId: user?.id, action: 'auth.login_failed', entityType: 'user', entityId: user?.id, context: ctx });
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    await this.users.touchLastLogin(user.id, this.clock.now());
    logger.info({ userId: user.id }, 'User logged in');
    await this.audit.record({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, context: ctx });
    return this.startSession(user, randomUUID(), ctx);
  }

  /**
   * Rotates the refresh token. Presenting a token that was already rotated is treated as theft
   * and revokes the whole token family — unless it was rotated moments ago by a concurrent
   * request (e.g. two tabs refreshing at once), in which case we just ask the client to retry.
   */
  async refresh(rawToken: string | undefined, ctx: RequestContext): Promise<Session> {
    if (!rawToken) throw new AuthenticationError('No session', 'REFRESH_TOKEN_MISSING');
    const now = this.clock.now();

    const result = await this.tx.run(async (tx) => {
      const stored = await this.refreshTokens.findByHash(sha256(rawToken), tx);
      if (!stored) return { kind: 'invalid' as const };

      if (stored.revokedAt) {
        const recentlyRotated = now.getTime() - stored.revokedAt.getTime() < 10_000;
        if (recentlyRotated) return { kind: 'race' as const };
        await this.refreshTokens.revokeFamily(stored.familyId, now, tx);
        return { kind: 'reuse' as const, userId: stored.userId };
      }
      if (stored.expiresAt <= now) return { kind: 'invalid' as const };

      const won = await this.refreshTokens.revokeIfActive(stored.id, now, tx);
      if (!won) return { kind: 'race' as const };

      const user = await this.users.findById(stored.userId, tx);
      if (!user) return { kind: 'invalid' as const };
      return { kind: 'ok' as const, user, familyId: stored.familyId };
    });

    switch (result.kind) {
      case 'ok':
        return this.startSession(result.user, result.familyId, ctx);
      case 'race':
        throw new AuthenticationError('Session was refreshed concurrently, retry', 'REFRESH_TOKEN_ROTATED');
      case 'reuse':
        logger.warn({ userId: result.userId, ip: ctx.ip }, 'Refresh token reuse detected — family revoked');
        await this.audit.record({ actorId: result.userId, action: 'auth.refresh_reuse', entityType: 'user', entityId: result.userId, context: ctx });
        throw new AuthenticationError('Session expired, please log in again', 'REFRESH_TOKEN_INVALID');
      case 'invalid':
        throw new AuthenticationError('Session expired, please log in again', 'REFRESH_TOKEN_INVALID');
    }
  }

  async logout(rawToken: string | undefined, ctx: RequestContext): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokens.findByHash(sha256(rawToken));
    if (!stored) return;
    await this.refreshTokens.revokeFamily(stored.familyId, this.clock.now());
    await this.audit.record({ actorId: stored.userId, action: 'auth.logout', entityType: 'user', entityId: stored.userId, context: ctx });
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');
    return toUserDto(user);
  }

  async updateProfile(userId: string, input: { name: string }): Promise<UserDto> {
    return toUserDto(await this.users.update(userId, { name: input.name }));
  }

  private async startSession(user: User, familyId: string, ctx: RequestContext): Promise<Session> {
    const refreshToken = generateOpaqueToken();
    const refreshTokenExpiresAt = addDays(this.clock.now(), this.config.refreshTtlDays);
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      familyId,
      expiresAt: refreshTokenExpiresAt,
      userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      ipAddress: ctx.ip ?? null,
    });
    return {
      user: toUserDto(user),
      accessToken: this.tokens.signAccessToken({ id: user.id, role: user.role }),
      accessTokenExpiresIn: Math.floor(this.tokens.accessTtlMs / 1000),
      refreshToken,
      refreshTokenExpiresAt,
    };
  }
}
