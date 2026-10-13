import type { Auction } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertBidAllowed,
  canTransition,
  determineOutcome,
  minimumNextBid,
  softCloseExtension,
} from '../../src/services/auction-rules.js';
import { BusinessRuleError } from '../../src/utils/errors.js';

const NOW = new Date('2026-01-01T12:00:00Z');
const minutesFromNow = (m: number) => new Date(NOW.getTime() + m * 60_000);

function auction(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'a1',
    bikeId: 'b1',
    status: 'LIVE',
    startingPrice: 100_000,
    reservePrice: null,
    minimumIncrement: 1_000,
    currentPrice: null,
    highestBidderId: null,
    bidCount: 0,
    startsAt: minutesFromNow(-60),
    endsAt: minutesFromNow(60),
    extensionCount: 0,
    outcome: null,
    winnerId: null,
    startedAt: minutesFromNow(-60),
    endedAt: null,
    archivedAt: null,
    cancelledAt: null,
    cancelReason: null,
    version: 0,
    createdById: 'admin',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function expectRuleError(fn: () => void, code: string) {
  try {
    fn();
    expect.unreachable(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessRuleError);
    expect((error as BusinessRuleError).code).toBe(code);
  }
}

describe('minimumNextBid', () => {
  it('is the starting price when there are no bids', () => {
    expect(minimumNextBid(auction())).toBe(100_000);
  });

  it('is the current price plus the increment once bidding has started', () => {
    expect(minimumNextBid(auction({ currentPrice: 120_000 }))).toBe(121_000);
  });
});

describe('assertBidAllowed', () => {
  it('accepts a bid equal to the minimum next bid', () => {
    expect(() => assertBidAllowed(auction({ currentPrice: 120_000 }), 'u1', 121_000, NOW)).not.toThrow();
  });

  it('accepts the starting price as the first bid', () => {
    expect(() => assertBidAllowed(auction(), 'u1', 100_000, NOW)).not.toThrow();
  });

  it('rejects bids below the minimum increment', () => {
    expectRuleError(() => assertBidAllowed(auction({ currentPrice: 120_000 }), 'u1', 120_500, NOW), 'BID_TOO_LOW');
  });

  it('rejects bids equal to the current price', () => {
    expectRuleError(() => assertBidAllowed(auction({ currentPrice: 120_000 }), 'u1', 120_000, NOW), 'BID_TOO_LOW');
  });

  it('rejects bids when the auction is not live', () => {
    expectRuleError(() => assertBidAllowed(auction({ status: 'SCHEDULED' }), 'u1', 100_000, NOW), 'AUCTION_NOT_LIVE');
  });

  it('rejects bids before the start time', () => {
    expectRuleError(
      () => assertBidAllowed(auction({ startsAt: minutesFromNow(5) }), 'u1', 100_000, NOW),
      'AUCTION_NOT_STARTED',
    );
  });

  it('rejects bids at or after the end time', () => {
    expectRuleError(() => assertBidAllowed(auction({ endsAt: NOW }), 'u1', 100_000, NOW), 'AUCTION_ENDED');
  });

  it('prevents the leader from outbidding themselves', () => {
    expectRuleError(
      () => assertBidAllowed(auction({ currentPrice: 100_000, highestBidderId: 'u1' }), 'u1', 105_000, NOW),
      'ALREADY_HIGHEST_BIDDER',
    );
  });
});

describe('softCloseExtension', () => {
  const config = { windowSeconds: 60, extensionSeconds: 60, maxExtensions: 2 };

  it('does not extend when the bid is outside the closing window', () => {
    expect(softCloseExtension(auction({ endsAt: minutesFromNow(5) }), NOW, config)).toBeNull();
  });

  it('extends to now + extension when a bid lands in the closing window', () => {
    const result = softCloseExtension(auction({ endsAt: new Date(NOW.getTime() + 20_000) }), NOW, config);
    expect(result).toEqual(new Date(NOW.getTime() + 60_000));
  });

  it('stops extending once the maximum number of extensions is reached', () => {
    const closing = auction({ endsAt: new Date(NOW.getTime() + 20_000), extensionCount: 2 });
    expect(softCloseExtension(closing, NOW, config)).toBeNull();
  });

  it('is disabled when the window is zero', () => {
    const closing = auction({ endsAt: new Date(NOW.getTime() + 20_000) });
    expect(softCloseExtension(closing, NOW, { ...config, windowSeconds: 0 })).toBeNull();
  });
});

describe('determineOutcome', () => {
  it('reports NO_BIDS when nobody bid', () => {
    expect(determineOutcome(auction())).toEqual({ outcome: 'NO_BIDS', winnerId: null });
  });

  it('reports RESERVE_NOT_MET when the top bid is below reserve', () => {
    const a = auction({ currentPrice: 140_000, highestBidderId: 'u1', reservePrice: 150_000 });
    expect(determineOutcome(a)).toEqual({ outcome: 'RESERVE_NOT_MET', winnerId: null });
  });

  it('declares the highest bidder the winner when the reserve is met', () => {
    const a = auction({ currentPrice: 150_000, highestBidderId: 'u1', reservePrice: 150_000 });
    expect(determineOutcome(a)).toEqual({ outcome: 'SOLD', winnerId: 'u1' });
  });

  it('declares a winner when there is no reserve', () => {
    expect(determineOutcome(auction({ currentPrice: 100_000, highestBidderId: 'u2' }))).toEqual({
      outcome: 'SOLD',
      winnerId: 'u2',
    });
  });
});

describe('state machine', () => {
  it.each([
    ['DRAFT', 'SCHEDULED', true],
    ['SCHEDULED', 'LIVE', true],
    ['LIVE', 'ENDED', true],
    ['ENDED', 'ARCHIVED', true],
    ['LIVE', 'CANCELLED', true],
    ['DRAFT', 'LIVE', false],
    ['ENDED', 'LIVE', false],
    ['CANCELLED', 'SCHEDULED', false],
    ['ARCHIVED', 'ENDED', false],
  ] as const)('%s → %s allowed: %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });
});
