import type { Prisma } from '@prisma/client';
import type { AuctionRepository, AuctionSummaryRecord } from '../repositories/auction.repository.js';
import type { BidRepository } from '../repositories/bid.repository.js';
import type { NotificationRepository } from '../repositories/notification.repository.js';
import type { WatchlistRepository } from '../repositories/watchlist.repository.js';
import { paginate, type PageParams } from '../utils/pagination.js';
import { toAuctionSummaryDto, type Viewer } from './mappers.js';

export type MyBidsFilter = 'active' | 'won' | 'lost' | 'all';

const FILTERS: Record<Exclude<MyBidsFilter, 'won'>, (userId: string) => Prisma.AuctionWhereInput> = {
  active: () => ({ status: 'LIVE' }),
  lost: (userId) => ({
    status: { in: ['ENDED', 'ARCHIVED', 'CANCELLED'] },
    OR: [{ winnerId: null }, { winnerId: { not: userId } }],
  }),
  all: () => ({}),
};

/** The buyer's personal views: bids, wins, losses, watchlist, dashboard counters. */
export class MeService {
  constructor(
    private readonly auctions: AuctionRepository,
    private readonly bids: BidRepository,
    private readonly watchlist: WatchlistRepository,
    private readonly notifications: NotificationRepository,
  ) {}

  async summary(viewer: Viewer) {
    const page = { page: 1, limit: 1 };
    const [[, active], [, won], [, lost], watching, unread] = await Promise.all([
      this.auctions.listForBidder(viewer.id, FILTERS.active(viewer.id), page),
      this.auctions.listWon(viewer.id, page),
      this.auctions.listForBidder(viewer.id, FILTERS.lost(viewer.id), page),
      this.watchlist.countForUser(viewer.id),
      this.notifications.countUnread(viewer.id),
    ]);
    return { activeBids: active, won, lost, watching, unreadNotifications: unread };
  }

  async myAuctions(viewer: Viewer, filter: MyBidsFilter, page: PageParams) {
    const [items, total] =
      filter === 'won'
        ? await this.auctions.listWon(viewer.id, page)
        : await this.auctions.listForBidder(viewer.id, FILTERS[filter](viewer.id), page);
    return paginate(await this.withMyBids(items, viewer), total, page);
  }

  async watching(viewer: Viewer, page: PageParams) {
    const [items, total] = await this.watchlist.listForUser(viewer.id, page);
    return paginate(
      items.map((item) => toAuctionSummaryDto(item, viewer)),
      total,
      page,
    );
  }

  /** Decorates each auction with the viewer's own highest bid and whether they are leading. */
  private async withMyBids(items: AuctionSummaryRecord[], viewer: Viewer) {
    const myBids = await this.bids.maxBidsByUser(
      viewer.id,
      items.map((item) => item.id),
    );
    return items.map((item) => ({
      ...toAuctionSummaryDto(item, viewer),
      myHighestBid: myBids.get(item.id) ?? null,
      isLeading: item.highestBidderId === viewer.id,
    }));
  }
}
