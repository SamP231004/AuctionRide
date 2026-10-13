import { Prisma, type Auction, type AuctionStatus, type PrismaClient } from '@prisma/client';
import type { PageParams } from '../utils/pagination.js';
import { toSkipTake } from '../utils/pagination.js';
import type { DbClient } from './types.js';

/** Fields needed to render an auction card. */
export const auctionSummaryInclude = {
  bike: {
    select: {
      id: true,
      title: true,
      brand: true,
      model: true,
      year: true,
      engineCC: true,
      kilometers: true,
      owners: true,
      location: true,
      images: { orderBy: { position: 'asc' }, take: 1, select: { id: true, url: true } },
    },
  },
  highestBidder: { select: { id: true, name: true } },
} satisfies Prisma.AuctionInclude;

export const auctionDetailInclude = {
  bike: { include: { images: { orderBy: { position: 'asc' } } } },
  highestBidder: { select: { id: true, name: true } },
  winner: { select: { id: true, name: true, email: true } },
  _count: { select: { watchers: true } },
} satisfies Prisma.AuctionInclude;

export type AuctionSummaryRecord = Prisma.AuctionGetPayload<{ include: typeof auctionSummaryInclude }>;
export type AuctionDetailRecord = Prisma.AuctionGetPayload<{ include: typeof auctionDetailInclude }>;

export type AuctionSort = 'ending_soon' | 'starting_soon' | 'newest' | 'price_asc' | 'price_desc' | 'most_bids';

export interface AuctionListFilters {
  statuses: AuctionStatus[];
  q?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  sort: AuctionSort;
}

const SORT_ORDER: Record<AuctionSort, Prisma.AuctionOrderByWithRelationInput[]> = {
  ending_soon: [{ endsAt: 'asc' }, { id: 'asc' }],
  starting_soon: [{ startsAt: 'asc' }, { id: 'asc' }],
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ currentPrice: { sort: 'asc', nulls: 'first' } }, { startingPrice: 'asc' }, { id: 'asc' }],
  price_desc: [{ currentPrice: { sort: 'desc', nulls: 'last' } }, { startingPrice: 'desc' }, { id: 'asc' }],
  most_bids: [{ bidCount: 'desc' }, { endsAt: 'asc' }, { id: 'asc' }],
};

/** "Effective price" = current highest bid, or the starting price when there are no bids. */
function effectivePriceFilter(operator: 'gte' | 'lte', value: number): Prisma.AuctionWhereInput {
  return {
    OR: [{ currentPrice: { [operator]: value } }, { currentPrice: null, startingPrice: { [operator]: value } }],
  };
}

export class AuctionRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(filters: AuctionListFilters, page: PageParams): Promise<[AuctionSummaryRecord[], number]> {
    const and: Prisma.AuctionWhereInput[] = [{ status: { in: filters.statuses } }];

    const bike: Prisma.BikeWhereInput = {};
    if (filters.brand) bike.brand = { equals: filters.brand, mode: 'insensitive' };
    if (filters.minYear !== undefined || filters.maxYear !== undefined) {
      bike.year = {
        ...(filters.minYear !== undefined ? { gte: filters.minYear } : {}),
        ...(filters.maxYear !== undefined ? { lte: filters.maxYear } : {}),
      };
    }
    if (filters.q) {
      bike.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { brand: { contains: filters.q, mode: 'insensitive' } },
        { model: { contains: filters.q, mode: 'insensitive' } },
        { location: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(bike).length > 0) and.push({ bike });
    if (filters.minPrice !== undefined) and.push(effectivePriceFilter('gte', filters.minPrice));
    if (filters.maxPrice !== undefined) and.push(effectivePriceFilter('lte', filters.maxPrice));

    const where: Prisma.AuctionWhereInput = { AND: and };
    return this.db.$transaction([
      this.db.auction.findMany({
        where,
        include: auctionSummaryInclude,
        orderBy: SORT_ORDER[filters.sort],
        ...toSkipTake(page),
      }),
      this.db.auction.count({ where }),
    ]);
  }

  findById(id: string, tx: DbClient = this.db): Promise<Auction | null> {
    return tx.auction.findUnique({ where: { id } });
  }

  findDetail(id: string, tx: DbClient = this.db): Promise<AuctionDetailRecord | null> {
    return tx.auction.findUnique({ where: { id }, include: auctionDetailInclude });
  }

  findSummary(id: string, tx: DbClient = this.db): Promise<AuctionSummaryRecord | null> {
    return tx.auction.findUnique({ where: { id }, include: auctionSummaryInclude });
  }

  /**
   * Acquires a row-level write lock on the auction for the rest of the transaction, then reads it.
   * Concurrent bids/transitions on the same auction queue behind this lock; other auctions are unaffected.
   * Must be called inside a transaction.
   */
  async lockById(id: string, tx: Prisma.TransactionClient): Promise<Auction | null> {
    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM auctions WHERE id = ${id}::uuid FOR UPDATE`,
    );
    if (rows.length === 0) return null;
    return tx.auction.findUnique({ where: { id } });
  }

  create(data: Prisma.AuctionUncheckedCreateInput): Promise<AuctionDetailRecord> {
    return this.db.auction.create({ data, include: auctionDetailInclude });
  }

  update(id: string, data: Prisma.AuctionUncheckedUpdateInput, tx: DbClient = this.db): Promise<Auction> {
    return tx.auction.update({ where: { id }, data });
  }

  /** Optimistic-concurrency update: succeeds only if the row still has `expectedVersion`. */
  async updateIfVersion(
    id: string,
    expectedVersion: number,
    data: Prisma.AuctionUncheckedUpdateManyInput,
    tx: DbClient = this.db,
  ): Promise<boolean> {
    const result = await tx.auction.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  delete(id: string): Promise<Auction> {
    return this.db.auction.delete({ where: { id } });
  }

  /** Reconciliation queries — bounded so a large backlog is drained over several sweeps. */
  findDueToStart(now: Date, limit = 100): Promise<Pick<Auction, 'id'>[]> {
    return this.db.auction.findMany({
      where: { status: 'SCHEDULED', startsAt: { lte: now } },
      select: { id: true },
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
  }

  findDueToEnd(now: Date, limit = 100): Promise<Pick<Auction, 'id'>[]> {
    return this.db.auction.findMany({
      where: { status: 'LIVE', endsAt: { lte: now } },
      select: { id: true },
      orderBy: { endsAt: 'asc' },
      take: limit,
    });
  }

  findDueToArchive(endedBefore: Date, limit = 100): Promise<Pick<Auction, 'id'>[]> {
    return this.db.auction.findMany({
      where: { status: 'ENDED', endedAt: { lte: endedBefore } },
      select: { id: true },
      orderBy: { endedAt: 'asc' },
      take: limit,
    });
  }


  async distinctBrands(statuses: AuctionStatus[]): Promise<string[]> {
    const rows = await this.db.bike.findMany({
      where: { auctions: { some: { status: { in: statuses } } } },
      distinct: ['brand'],
      select: { brand: true },
      orderBy: { brand: 'asc' },
    });
    return rows.map((row) => row.brand);
  }

  countByStatus(): Promise<{ status: AuctionStatus; _count: { _all: number } }[]> {
    return this.db.auction
      .groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } })
      .then((rows) => rows as { status: AuctionStatus; _count: { _all: number } }[]);
  }

  listLive(limit: number): Promise<AuctionSummaryRecord[]> {
    return this.db.auction.findMany({
      where: { status: 'LIVE' },
      include: auctionSummaryInclude,
      orderBy: { endsAt: 'asc' },
      take: limit,
    });
  }

  async listWinners(page: PageParams): Promise<[AuctionDetailRecord[], number]> {
    const where: Prisma.AuctionWhereInput = { outcome: 'SOLD' };
    return this.db.$transaction([
      this.db.auction.findMany({
        where,
        include: auctionDetailInclude,
        orderBy: { endedAt: 'desc' },
        ...toSkipTake(page),
      }),
      this.db.auction.count({ where }),
    ]);
  }

  /** Auctions the user has bid on, optionally restricted by status / outcome relation to the user. */
  async listForBidder(
    bidderId: string,
    where: Prisma.AuctionWhereInput,
    page: PageParams,
  ): Promise<[AuctionSummaryRecord[], number]> {
    const fullWhere: Prisma.AuctionWhereInput = { AND: [{ bids: { some: { bidderId } } }, where] };
    return this.db.$transaction([
      this.db.auction.findMany({
        where: fullWhere,
        include: auctionSummaryInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        ...toSkipTake(page),
      }),
      this.db.auction.count({ where: fullWhere }),
    ]);
  }

  async listWon(userId: string, page: PageParams): Promise<[AuctionSummaryRecord[], number]> {
    const where: Prisma.AuctionWhereInput = { winnerId: userId };
    return this.db.$transaction([
      this.db.auction.findMany({
        where,
        include: auctionSummaryInclude,
        orderBy: [{ endedAt: 'desc' }, { id: 'asc' }],
        ...toSkipTake(page),
      }),
      this.db.auction.count({ where }),
    ]);
  }
}
