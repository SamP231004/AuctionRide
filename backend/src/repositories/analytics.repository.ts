import { Prisma, type PrismaClient } from '@prisma/client';

export interface DailyBidsPoint {
  day: string;
  bids: number;
  bidders: number;
}

export interface DailySalesPoint {
  day: string;
  sold: number;
  revenue: number;
}

export interface OutcomeBreakdown {
  sold: number;
  reserveNotMet: number;
  noBids: number;
}

export interface TopAuction {
  id: string;
  title: string;
  bidCount: number;
  currentPrice: number | null;
  status: string;
}

const toDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Read-only aggregate queries for the admin analytics screen. Raw SQL is used only where Prisma's
 * query builder cannot express the aggregation (date bucketing); all values are parameterised.
 * In a scaled deployment this repository is the natural candidate to point at a read replica.
 */
export class AnalyticsRepository {
  constructor(private readonly db: PrismaClient) {}

  async bidsPerDay(since: Date): Promise<DailyBidsPoint[]> {
    const rows = await this.db.$queryRaw<{ day: Date; bids: bigint; bidders: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
             COUNT(*) AS bids,
             COUNT(DISTINCT bidder_id) AS bidders
      FROM bids
      WHERE created_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((row) => ({ day: toDay(row.day), bids: Number(row.bids), bidders: Number(row.bidders) }));
  }

  async salesPerDay(since: Date): Promise<DailySalesPoint[]> {
    const rows = await this.db.$queryRaw<{ day: Date; sold: bigint; revenue: bigint | null }[]>(Prisma.sql`
      SELECT date_trunc('day', ended_at AT TIME ZONE 'UTC') AS day,
             COUNT(*) AS sold,
             SUM(current_price) AS revenue
      FROM auctions
      WHERE outcome = 'SOLD' AND ended_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((row) => ({ day: toDay(row.day), sold: Number(row.sold), revenue: Number(row.revenue ?? 0) }));
  }

  async newUsersPerDay(since: Date): Promise<{ day: string; users: number }[]> {
    const rows = await this.db.$queryRaw<{ day: Date; users: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, COUNT(*) AS users
      FROM users
      WHERE created_at >= ${since} AND role = 'BUYER'
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((row) => ({ day: toDay(row.day), users: Number(row.users) }));
  }

  async outcomeBreakdown(): Promise<OutcomeBreakdown> {
    const rows = await this.db.auction.groupBy({
      by: ['outcome'],
      where: { outcome: { not: null } },
      _count: { _all: true },
      orderBy: { outcome: 'asc' },
    });
    const count = (outcome: string) => rows.find((row) => row.outcome === outcome)?._count._all ?? 0;
    return { sold: count('SOLD'), reserveNotMet: count('RESERVE_NOT_MET'), noBids: count('NO_BIDS') };
  }

  async totals(): Promise<{ grossValue: number; averageSalePrice: number; averageBidsPerAuction: number }> {
    const [sold, ended] = await Promise.all([
      this.db.auction.aggregate({
        where: { outcome: 'SOLD' },
        _sum: { currentPrice: true },
        _avg: { currentPrice: true },
      }),
      this.db.auction.aggregate({ where: { outcome: { not: null } }, _avg: { bidCount: true } }),
    ]);
    return {
      grossValue: sold._sum.currentPrice ?? 0,
      averageSalePrice: Math.round(sold._avg.currentPrice ?? 0),
      averageBidsPerAuction: Number((ended._avg.bidCount ?? 0).toFixed(1)),
    };
  }

  async topAuctions(limit: number): Promise<TopAuction[]> {
    const rows = await this.db.auction.findMany({
      where: { bidCount: { gt: 0 } },
      orderBy: [{ bidCount: 'desc' }, { currentPrice: 'desc' }],
      take: limit,
      select: { id: true, bidCount: true, currentPrice: true, status: true, bike: { select: { title: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.bike.title,
      bidCount: row.bidCount,
      currentPrice: row.currentPrice,
      status: row.status,
    }));
  }
}
