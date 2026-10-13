import type { Auction, Prisma } from '@prisma/client';
import type { AuctionRepository } from '../repositories/auction.repository.js';
import type { BidRepository } from '../repositories/bid.repository.js';
import type { TransactionManager } from '../repositories/types.js';
import type { WatchlistRepository } from '../repositories/watchlist.repository.js';
import type { AuctionScheduler, RealtimePublisher } from '../types/ports.js';
import { BusinessRuleError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { addHours, type Clock } from '../utils/time.js';
import { assertTransition, determineOutcome } from './auction-rules.js';
import type { AuditService, RequestContext } from './audit.service.js';
import { toAuctionState } from './mappers.js';
import type { NotificationService } from './notification.service.js';

/** Who triggered a transition. System triggers (jobs) are lenient; admin triggers are strict. */
export type Trigger = { kind: 'system' } | { kind: 'admin'; actorId: string; context?: RequestContext };

const SYSTEM: Trigger = { kind: 'system' };

export interface LifecycleConfig {
  archiveAfterHours: number;
}

/**
 * The only place auction status changes. Every transition:
 *   1. locks the auction row and re-reads it (so concurrent bids/jobs/admins serialise),
 *   2. validates the transition against the state machine,
 *   3. commits, then performs side effects (jobs, broadcasts, notifications, audit).
 *
 * System-triggered calls are idempotent: a stale or duplicate job simply does nothing.
 */
export class AuctionLifecycleService {
  constructor(
    private readonly auctions: AuctionRepository,
    private readonly bids: BidRepository,
    private readonly watchlist: WatchlistRepository,
    private readonly tx: TransactionManager,
    private readonly scheduler: AuctionScheduler,
    private readonly realtime: RealtimePublisher,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly config: LifecycleConfig,
  ) {}

  async publish(id: string, trigger: Trigger): Promise<void> {
    const auction = await this.mutate(id, (current, now) => {
      assertTransition(current.status, 'SCHEDULED');
      if (current.endsAt.getTime() <= now.getTime() + 60_000) {
        throw new BusinessRuleError('INVALID_SCHEDULE', 'End time must be at least one minute in the future');
      }
      return { status: 'SCHEDULED' };
    });
    if (!auction) return;
    await this.scheduler.scheduleStart(id, auction.startsAt);
    await this.afterTransition(auction, 'auction.publish', trigger);
  }

  async unpublish(id: string, trigger: Trigger): Promise<void> {
    const auction = await this.mutate(id, (current) => {
      assertTransition(current.status, 'DRAFT');
      return { status: 'DRAFT' };
    });
    if (!auction) return;
    await this.scheduler.cancel(id);
    await this.afterTransition(auction, 'auction.unpublish', trigger);
  }

  async start(id: string, trigger: Trigger = SYSTEM): Promise<void> {
    let tooEarly = null as Date | null;
    const auction = await this.mutate(id, (current, now) => {
      if (trigger.kind === 'system') {
        if (current.status !== 'SCHEDULED') return null;
        if (current.startsAt > now) {
          tooEarly = current.startsAt;
          return null;
        }
      } else {
        assertTransition(current.status, 'LIVE');
      }
      if (current.endsAt <= now) {
        throw new BusinessRuleError('INVALID_SCHEDULE', 'Cannot start an auction whose end time has passed');
      }
      // A manual early start moves startsAt to now so "bid before start" checks stay consistent.
      return { status: 'LIVE', startedAt: now, ...(current.startsAt > now ? { startsAt: now } : {}) };
    });

    if (tooEarly) await this.scheduler.scheduleStart(id, tooEarly);
    if (!auction) return;

    await this.scheduler.scheduleEnd(id, auction.endsAt);
    await this.afterTransition(auction, 'auction.start', trigger);

    const watchers = await this.watchlist.watcherIds(id);
    await this.notifications.notifyMany(watchers, {
      type: 'AUCTION_STARTED',
      title: 'An auction you watch is live',
      body: 'Bidding is now open. Good luck!',
      auctionId: id,
    });
  }

  async end(id: string, trigger: Trigger = SYSTEM): Promise<void> {
    let extendedTo = null as Date | null;
    const auction = await this.mutate(id, (current, now) => {
      if (trigger.kind === 'system') {
        if (current.status !== 'LIVE') return null;
        // Soft close may have pushed endsAt back after this job was queued.
        if (current.endsAt > now) {
          extendedTo = current.endsAt;
          return null;
        }
      } else {
        assertTransition(current.status, 'ENDED');
      }
      const { outcome, winnerId } = determineOutcome(current);
      return {
        status: 'ENDED',
        endedAt: now,
        outcome,
        winnerId,
        ...(current.endsAt > now ? { endsAt: now } : {}),
      };
    });

    if (extendedTo) await this.scheduler.scheduleEnd(id, extendedTo);
    if (!auction) return;

    await this.scheduler.scheduleArchive(id, addHours(auction.endedAt ?? this.clock.now(), this.config.archiveAfterHours));
    await this.afterTransition(auction, 'auction.end', trigger);
    logger.info({ auctionId: id, outcome: auction.outcome, winnerId: auction.winnerId }, 'Auction ended');

    const bidderIds = await this.bids.distinctBidderIds(id);
    if (auction.winnerId) {
      await this.notifications.notifyMany([auction.winnerId], {
        type: 'AUCTION_WON',
        title: 'You won the auction! 🎉',
        body: `Your winning bid was ₹${auction.currentPrice?.toLocaleString('en-IN')}. Our team will contact you shortly.`,
        auctionId: id,
      });
    }
    await this.notifications.notifyMany(
      bidderIds.filter((bidderId) => bidderId !== auction.winnerId),
      {
        type: 'AUCTION_LOST',
        title: 'Auction ended',
        body:
          auction.outcome === 'RESERVE_NOT_MET'
            ? 'The auction ended without meeting the reserve price.'
            : 'The auction ended and you were outbid.',
        auctionId: id,
      },
    );
  }

  async archive(id: string): Promise<void> {
    const auction = await this.mutate(id, (current, now) => {
      if (current.status !== 'ENDED' || !current.endedAt) return null;
      if (addHours(current.endedAt, this.config.archiveAfterHours) > now) return null;
      return { status: 'ARCHIVED', archivedAt: now };
    });
    if (auction) await this.afterTransition(auction, 'auction.archive', SYSTEM);
  }

  async cancel(id: string, reason: string, trigger: Trigger): Promise<void> {
    let previousStatus = null as Auction['status'] | null;
    const auction = await this.mutate(id, (current, now) => {
      assertTransition(current.status, 'CANCELLED');
      previousStatus = current.status;
      return { status: 'CANCELLED', cancelledAt: now, cancelReason: reason };
    });
    if (!auction) return;

    await this.scheduler.cancel(id);
    await this.afterTransition(auction, 'auction.cancel', trigger, { reason });

    if (previousStatus !== 'DRAFT') {
      const [bidders, watchers] = await Promise.all([this.bids.distinctBidderIds(id), this.watchlist.watcherIds(id)]);
      await this.notifications.notifyMany([...bidders, ...watchers], {
        type: 'AUCTION_CANCELLED',
        title: 'Auction cancelled',
        body: `An auction you were following was cancelled: ${reason}`,
        auctionId: id,
      });
    }
  }

  /**
   * Safety net run every minute: applies any transitions whose time has passed but whose
   * delayed job never fired (Redis flushed, worker down during the due time, ...).
   */
  async reconcile(): Promise<{ started: number; ended: number; archived: number }> {
    const now = this.clock.now();
    const [toStart, toEnd, toArchive] = await Promise.all([
      this.auctions.findDueToStart(now),
      this.auctions.findDueToEnd(now),
      this.auctions.findDueToArchive(addHours(now, -this.config.archiveAfterHours)),
    ]);
    for (const { id } of toStart) await this.start(id);
    for (const { id } of toEnd) await this.end(id);
    for (const { id } of toArchive) await this.archive(id);

    const counts = { started: toStart.length, ended: toEnd.length, archived: toArchive.length };
    if (counts.started + counts.ended + counts.archived > 0) logger.info(counts, 'Auction reconciliation applied');
    return counts;
  }

  /** Lock → validate → update, inside one transaction. `apply` returns null to make no change. */
  private async mutate(
    id: string,
    apply: (current: Auction, now: Date) => Prisma.AuctionUncheckedUpdateInput | null,
  ): Promise<Auction | null> {
    return this.tx.run(async (tx) => {
      const current = await this.auctions.lockById(id, tx);
      if (!current) throw new NotFoundError('Auction');
      const data = apply(current, this.clock.now());
      if (!data) return null;
      return this.auctions.update(id, { ...data, version: { increment: 1 } }, tx);
    });
  }

  private async afterTransition(
    auction: Auction,
    action: string,
    trigger: Trigger,
    metadata: Record<string, string> = {},
  ): Promise<void> {
    const summary = await this.auctions.findSummary(auction.id);
    if (summary) this.realtime.auctionUpdated(toAuctionState(summary));

    await this.audit.record({
      actorId: trigger.kind === 'admin' ? trigger.actorId : null,
      action,
      entityType: 'auction',
      entityId: auction.id,
      metadata: { status: auction.status, trigger: trigger.kind, ...metadata },
      context: trigger.kind === 'admin' ? trigger.context : undefined,
    });
  }
}
