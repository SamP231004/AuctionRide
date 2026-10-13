import type { Auction, AuctionOutcome, AuctionStatus } from '@prisma/client';
import { BID_LIMITS } from '../config/constants.js';
import { BusinessRuleError, ConflictError } from '../utils/errors.js';
import { addSeconds } from '../utils/time.js';

/**
 * Pure auction domain rules — no I/O, so they are exhaustively unit-tested.
 */

type PricingFields = Pick<Auction, 'startingPrice' | 'currentPrice' | 'minimumIncrement'>;

export function minimumNextBid(auction: PricingFields): number {
  return auction.currentPrice === null ? auction.startingPrice : auction.currentPrice + auction.minimumIncrement;
}

type BiddableFields = PricingFields & Pick<Auction, 'status' | 'startsAt' | 'endsAt' | 'highestBidderId'>;

/** Throws a typed error if `amount` from `bidderId` cannot be accepted at time `now`. */
export function assertBidAllowed(auction: BiddableFields, bidderId: string, amount: number, now: Date): void {
  if (auction.status !== 'LIVE') {
    throw new BusinessRuleError('AUCTION_NOT_LIVE', 'This auction is not accepting bids');
  }
  if (now < auction.startsAt) {
    throw new BusinessRuleError('AUCTION_NOT_STARTED', 'This auction has not started yet');
  }
  if (now >= auction.endsAt) {
    throw new BusinessRuleError('AUCTION_ENDED', 'This auction has ended');
  }
  if (auction.highestBidderId === bidderId) {
    throw new BusinessRuleError('ALREADY_HIGHEST_BIDDER', 'You are already the highest bidder');
  }
  const minimum = minimumNextBid(auction);
  if (amount < minimum) {
    throw new BusinessRuleError('BID_TOO_LOW', `Bid must be at least ₹${minimum.toLocaleString('en-IN')}`, {
      minimumBid: minimum,
    });
  }
  if (amount > BID_LIMITS.MAX_AMOUNT) {
    throw new BusinessRuleError('BID_TOO_HIGH', 'Bid amount exceeds the maximum allowed');
  }
}

export interface SoftCloseConfig {
  windowSeconds: number;
  extensionSeconds: number;
  maxExtensions: number;
}

/**
 * Anti-sniping: a bid in the last `windowSeconds` pushes the end to `now + extensionSeconds`.
 * Returns the new end time, or null when no extension applies.
 */
export function softCloseExtension(
  auction: Pick<Auction, 'endsAt' | 'extensionCount'>,
  now: Date,
  config: SoftCloseConfig,
): Date | null {
  if (config.windowSeconds === 0 || config.extensionSeconds === 0) return null;
  if (auction.extensionCount >= config.maxExtensions) return null;
  const remainingMs = auction.endsAt.getTime() - now.getTime();
  if (remainingMs > config.windowSeconds * 1000) return null;
  const extended = addSeconds(now, config.extensionSeconds);
  return extended > auction.endsAt ? extended : null;
}

export function determineOutcome(
  auction: Pick<Auction, 'currentPrice' | 'reservePrice' | 'highestBidderId'>,
): { outcome: AuctionOutcome; winnerId: string | null } {
  if (auction.currentPrice === null || auction.highestBidderId === null) {
    return { outcome: 'NO_BIDS', winnerId: null };
  }
  if (auction.reservePrice !== null && auction.currentPrice < auction.reservePrice) {
    return { outcome: 'RESERVE_NOT_MET', winnerId: null };
  }
  return { outcome: 'SOLD', winnerId: auction.highestBidderId };
}

const TRANSITIONS: Record<AuctionStatus, readonly AuctionStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['DRAFT', 'LIVE', 'CANCELLED'],
  LIVE: ['ENDED', 'CANCELLED'],
  ENDED: ['ARCHIVED'],
  ARCHIVED: [],
  CANCELLED: [],
};

export function canTransition(from: AuctionStatus, to: AuctionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AuctionStatus, to: AuctionStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Cannot move an auction from ${from} to ${to}`, 'INVALID_STATE_TRANSITION', { from, to });
  }
}

/** Statuses visible to the public. Drafts and cancelled auctions are admin-only in listings. */
export const PUBLIC_STATUSES: AuctionStatus[] = ['SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED'];
