import type { PrismaClient } from '@prisma/client';
import type { PageParams } from '../utils/pagination.js';
import { toSkipTake } from '../utils/pagination.js';
import { auctionSummaryInclude, type AuctionSummaryRecord } from './auction.repository.js';
import type { DbClient } from './types.js';

export class WatchlistRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Idempotent: watching twice is not an error. */
  async add(userId: string, auctionId: string): Promise<void> {
    await this.db.watchlist.upsert({
      where: { userId_auctionId: { userId, auctionId } },
      create: { userId, auctionId },
      update: {},
    });
  }

  async remove(userId: string, auctionId: string): Promise<void> {
    await this.db.watchlist.deleteMany({ where: { userId, auctionId } });
  }

  async isWatching(userId: string, auctionId: string): Promise<boolean> {
    const row = await this.db.watchlist.findUnique({
      where: { userId_auctionId: { userId, auctionId } },
      select: { userId: true },
    });
    return row !== null;
  }

  async watcherIds(auctionId: string, tx: DbClient = this.db): Promise<string[]> {
    const rows = await tx.watchlist.findMany({ where: { auctionId }, select: { userId: true } });
    return rows.map((row) => row.userId);
  }

  async listForUser(userId: string, page: PageParams): Promise<[AuctionSummaryRecord[], number]> {
    const where = { watchers: { some: { userId } } };
    return this.db.$transaction([
      this.db.auction.findMany({
        where,
        include: auctionSummaryInclude,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        ...toSkipTake(page),
      }),
      this.db.auction.count({ where }),
    ]);
  }

  countForUser(userId: string): Promise<number> {
    return this.db.watchlist.count({ where: { userId } });
  }
}
