import { CACHE_TTL_SECONDS } from '../config/constants.js';
import type { AnalyticsRepository } from '../repositories/analytics.repository.js';
import type { AuctionRepository } from '../repositories/auction.repository.js';
import type { BidRepository } from '../repositories/bid.repository.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { Cache } from '../types/ports.js';
import { paginate, type PageParams } from '../utils/pagination.js';
import { addDays, addHours, type Clock } from '../utils/time.js';
import { toAuctionDetailDto, toAuctionSummaryDto, type Viewer } from './mappers.js';

export class AdminService {
  constructor(
    private readonly auctions: AuctionRepository,
    private readonly bids: BidRepository,
    private readonly users: UserRepository,
    private readonly analytics: AnalyticsRepository,
    private readonly cache: Cache,
    private readonly clock: Clock,
  ) {}

  async dashboard(viewer: Viewer) {
    const now = this.clock.now();
    const [statusCounts, buyers, bids24h, live, recentBids, totals] = await Promise.all([
      this.auctions.countByStatus(),
      this.users.countByRole('BUYER'),
      this.bids.countSince(addHours(now, -24)),
      this.auctions.listLive(6),
      this.bids.recent(10),
      this.analytics.totals(),
    ]);

    const byStatus = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all]));
    return {
      counts: {
        live: byStatus.LIVE ?? 0,
        scheduled: byStatus.SCHEDULED ?? 0,
        draft: byStatus.DRAFT ?? 0,
        ended: (byStatus.ENDED ?? 0) + (byStatus.ARCHIVED ?? 0),
        buyers,
        bidsLast24h: bids24h,
      },
      grossValue: totals.grossValue,
      liveAuctions: live.map((auction) => toAuctionSummaryDto(auction, viewer)),
      recentBids: recentBids.map((bid) => ({
        id: bid.id,
        amount: bid.amount,
        createdAt: bid.createdAt,
        bidder: bid.bidder,
        auction: { id: bid.auction.id, title: bid.auction.bike.title },
      })),
    };
  }

  /** Aggregations are comparatively expensive and tolerate staleness → cached for a minute. */
  async analyticsReport(days: number) {
    const key = `cache:admin:analytics:${days}`;
    const cached = await this.cache.get<Awaited<ReturnType<AdminService['buildAnalytics']>>>(key);
    if (cached) return cached;
    const report = await this.buildAnalytics(days);
    await this.cache.set(key, report, CACHE_TTL_SECONDS.ADMIN_ANALYTICS);
    return report;
  }

  async winners(page: PageParams, viewer: Viewer) {
    const [items, total] = await this.auctions.listWinners(page);
    return paginate(
      items.map((item) => toAuctionDetailDto(item, viewer, false)),
      total,
      page,
    );
  }

  private async buildAnalytics(days: number) {
    const since = addDays(this.clock.now(), -days);
    const [bidsPerDay, salesPerDay, newUsersPerDay, outcomes, totals, topAuctions] = await Promise.all([
      this.analytics.bidsPerDay(since),
      this.analytics.salesPerDay(since),
      this.analytics.newUsersPerDay(since),
      this.analytics.outcomeBreakdown(),
      this.analytics.totals(),
      this.analytics.topAuctions(5),
    ]);
    const finished = outcomes.sold + outcomes.reserveNotMet + outcomes.noBids;
    return {
      rangeDays: days,
      totals: {
        ...totals,
        sellThroughRate: finished === 0 ? 0 : Number((outcomes.sold / finished).toFixed(3)),
      },
      outcomes,
      bidsPerDay,
      salesPerDay,
      newUsersPerDay,
      topAuctions,
      generatedAt: this.clock.now(),
    };
  }
}
