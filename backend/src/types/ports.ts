import type { AuctionOutcome, AuctionStatus } from '@prisma/client';
import type { BidDto, NotificationDto } from '../services/mappers.js';

/**
 * Ports for side effects that services trigger but should not know the mechanics of.
 * Production adapters: Socket.IO (socket/publisher.ts) and BullMQ (jobs/auction.scheduler.ts).
 * Tests use in-memory fakes.
 */

export interface AuctionStatePayload {
  auctionId: string;
  status: AuctionStatus;
  currentPrice: number | null;
  minimumNextBid: number;
  bidCount: number;
  highestBidder: { id: string; name: string } | null;
  endsAt: Date;
  outcome: AuctionOutcome | null;
  winnerId: string | null;
}

export interface BidPlacedPayload {
  auctionId: string;
  bid: BidDto;
  auction: AuctionStatePayload;
  extended: boolean;
}

export interface RealtimePublisher {
  bidPlaced(payload: BidPlacedPayload): void;
  auctionUpdated(payload: AuctionStatePayload): void;
  notify(userId: string, notification: NotificationDto): void;
}

export interface AuctionScheduler {
  scheduleStart(auctionId: string, at: Date): Promise<void>;
  scheduleEnd(auctionId: string, at: Date): Promise<void>;
  scheduleArchive(auctionId: string, at: Date): Promise<void>;
  /** Removes any pending lifecycle jobs (on cancel / unpublish / delete). */
  cancel(auctionId: string): Promise<void>;
}

/** Small cache abstraction (Redis in production, no-op in tests). */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export interface StorageProvider {
  save(file: { buffer: Buffer; extension: string }): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
}
