import { Prisma } from '@prisma/client';
import type { AuctionRepository } from '../repositories/auction.repository.js';
import type { BidRepository } from '../repositories/bid.repository.js';
import type { TransactionManager } from '../repositories/types.js';
import type { AuctionScheduler, RealtimePublisher } from '../types/ports.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { paginate, type PageParams } from '../utils/pagination.js';
import type { Clock } from '../utils/time.js';
import { assertBidAllowed, softCloseExtension, type SoftCloseConfig, PUBLIC_STATUSES } from './auction-rules.js';
import { toAuctionState, toBidDto, type Viewer } from './mappers.js';
import type { NotificationService } from './notification.service.js';

export class BidService {
  constructor(
    private readonly auctions: AuctionRepository,
    private readonly bids: BidRepository,
    private readonly tx: TransactionManager,
    private readonly scheduler: AuctionScheduler,
    private readonly realtime: RealtimePublisher,
    private readonly notifications: NotificationService,
    private readonly clock: Clock,
    private readonly softClose: SoftCloseConfig,
  ) {}

  /**
   * Places a bid. The auction row is locked for the duration of the transaction, so concurrent bids
   * on the same auction are processed strictly one after another against fresh state.
   * See docs/ARCHITECTURE.md §5.
   */
  async placeBid(auctionId: string, bidder: Viewer, amount: number) {
    const result = await this.tx
      .run(async (tx) => {
        const auction = await this.auctions.lockById(auctionId, tx);
        if (!auction) throw new NotFoundError('Auction');

        const now = this.clock.now();
        assertBidAllowed(auction, bidder.id, amount, now);

        const newEndsAt = softCloseExtension(auction, now, this.softClose);
        const bid = await this.bids.create({ auctionId, bidderId: bidder.id, amount }, tx);
        await this.auctions.update(
          auctionId,
          {
            currentPrice: amount,
            highestBidderId: bidder.id,
            bidCount: { increment: 1 },
            ...(newEndsAt ? { endsAt: newEndsAt, extensionCount: { increment: 1 } } : {}),
          },
          tx,
        );
        return { bid, previousLeaderId: auction.highestBidderId, extendedTo: newEndsAt };
      })
      .catch((error: unknown) => {
        // The unique (auction_id, amount) constraint is a backstop behind the row lock.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictError('Someone just placed this exact bid. Please bid higher.', 'BID_CONFLICT');
        }
        throw error;
      });

    logger.info({ auctionId, bidderId: bidder.id, amount, extended: Boolean(result.extendedTo) }, 'Bid placed');

    const summary = await this.auctions.findSummary(auctionId);
    if (!summary) throw new NotFoundError('Auction');
    const state = toAuctionState(summary);

    // Broadcast with public (masked) identity; each client checks highestBidder.id against itself.
    this.realtime.bidPlaced({
      auctionId,
      bid: toBidDto(result.bid),
      auction: state,
      extended: result.extendedTo !== null,
    });

    if (result.extendedTo) await this.scheduler.scheduleEnd(auctionId, result.extendedTo);

    if (result.previousLeaderId && result.previousLeaderId !== bidder.id) {
      await this.notifications.notifyMany([result.previousLeaderId], {
        type: 'OUTBID',
        title: "You've been outbid",
        body: `${summary.bike.title} is now at ₹${amount.toLocaleString('en-IN')}.`,
        auctionId,
      });
    }

    return { bid: toBidDto(result.bid, bidder), auction: state };
  }

  async listForAuction(auctionId: string, page: PageParams, viewer?: Viewer) {
    const auction = await this.auctions.findById(auctionId);
    const visible = auction && (viewer?.role === 'ADMIN' || PUBLIC_STATUSES.includes(auction.status) || auction.status === 'CANCELLED');
    if (!visible) throw new NotFoundError('Auction');

    const [items, total] = await this.bids.listForAuction(auctionId, page);
    return paginate(
      items.map((bid) => toBidDto(bid, viewer)),
      total,
      page,
    );
  }
}
