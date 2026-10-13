import type { PrismaClient, RefreshToken } from '@prisma/client';
import type { DbClient } from './types.js';

export class RefreshTokenRepository {
  constructor(private readonly db: PrismaClient) {}

  create(
    data: {
      userId: string;
      tokenHash: string;
      familyId: string;
      expiresAt: Date;
      userAgent?: string | null;
      ipAddress?: string | null;
    },
    tx: DbClient = this.db,
  ): Promise<RefreshToken> {
    return tx.refreshToken.create({ data });
  }

  findByHash(tokenHash: string, tx: DbClient = this.db): Promise<RefreshToken | null> {
    return tx.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Atomically revokes a token only if still active. Returns false when another request
   * rotated it first — the caller uses this to detect concurrent refreshes.
   */
  async revokeIfActive(id: string, at: Date, tx: DbClient = this.db): Promise<boolean> {
    const result = await tx.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
    return result.count === 1;
  }

  async hasActiveInFamily(familyId: string, now: Date, tx: DbClient = this.db): Promise<boolean> {
    const count = await tx.refreshToken.count({ where: { familyId, revokedAt: null, expiresAt: { gt: now } } });
    return count > 0;
  }

  async revokeFamily(familyId: string, at: Date, tx: DbClient = this.db): Promise<number> {
    const result = await tx.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
    return result.count;
  }

  /** Housekeeping: drop tokens that expired or were revoked before the cutoff. */
  async deleteStale(cutoff: Date): Promise<number> {
    const result = await this.db.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
    });
    return result.count;
  }
}
