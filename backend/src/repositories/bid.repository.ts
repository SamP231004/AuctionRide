import type { Prisma, PrismaClient } from '@prisma/client';
import type { PageParams } from '../utils/pagination.js';
import { toSkipTake } from '../utils/pagination.js';
import type { DbClient } from './types.js';

export const bidWithBidder = {
  bidder: { select: { id: true, name: true } },
} satisfies Prisma.BidInclude;

export type BidWithBidder = Prisma.BidGetPayload<{ include: typeof bidWithBidder }>;

export type RecentBid = Prisma.BidGetPayload<{
  include: {
    bidder: { select: { id: true; name: true } };
    auction: { select: { id: true; bike: { select: { title: true } } } };
  };
}>;

export class BidRepository {
  constructor(private readonly db: PrismaClient) {}

  create(
    data: { auctionId: string; bidderId: string; amount: number },
    tx: DbClient = this.db,
  ): Promise<BidWithBidder> {
    return tx.bid.create({ data, include: bidWithBidder });
  }

  /** Newest first. Amounts strictly increase, so this is also highest-first. */
  async listForAuction(auctionId: string, page: PageParams): Promise<[BidWithBidder[], number]> {
    return this.db.$transaction([
      this.db.bid.findMany({
        where: { auctionId },
        include: bidWithBidder,
        orderBy: { amount: 'desc' },
        ...toSkipTake(page),
      }),
      this.db.bid.count({ where: { auctionId } }),
    ]);
  }

  /** Distinct bidder ids on an auction (for end-of-auction notifications). */
  async distinctBidderIds(auctionId: string, tx: DbClient = this.db): Promise<string[]> {
    const rows = await tx.bid.findMany({
      where: { auctionId },
      distinct: ['bidderId'],
      select: { bidderId: true },
    });
    return rows.map((row) => row.bidderId);
  }

  /** The user's highest bid on each of the given auctions. */
  async maxBidsByUser(bidderId: string, auctionIds: string[]): Promise<Map<string, number>> {
    if (auctionIds.length === 0) return new Map();
    const rows = await this.db.bid.groupBy({
      by: ['auctionId'],
      where: { bidderId, auctionId: { in: auctionIds } },
      _max: { amount: true },
      orderBy: { auctionId: 'asc' },
    });
    return new Map(rows.map((row) => [row.auctionId, row._max?.amount ?? 0]));
  }

  countSince(since: Date): Promise<number> {
    return this.db.bid.count({ where: { createdAt: { gte: since } } });
  }

  recent(limit: number): Promise<RecentBid[]> {
    return this.db.bid.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        bidder: { select: { id: true, name: true } },
        auction: { select: { id: true, bike: { select: { title: true } } } },
      },
    });
  }
}
