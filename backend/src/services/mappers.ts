import type { Auction, BikeImage, Notification, Role, User } from '@prisma/client';
import type { AuctionDetailRecord, AuctionSummaryRecord } from '../repositories/auction.repository.js';
import type { BidWithBidder } from '../repositories/bid.repository.js';
import type { BikeWithImages } from '../repositories/bike.repository.js';
import type { AuctionStatePayload } from '../types/ports.js';
import { maskName } from '../utils/privacy.js';
import { minimumNextBid } from './auction-rules.js';

/**
 * Persistence records → API DTOs. Keeping this mapping explicit means a new database column is
 * never exposed by accident (e.g. reserve price, password hash).
 */

export interface Viewer {
  id: string;
  role: Role;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const isAdmin = (viewer?: Viewer) => viewer?.role === 'ADMIN';

/** Bidders see their own name, admins see everyone's; the public sees masked names. */
function publicName(user: { id: string; name: string }, viewer?: Viewer): string {
  return isAdmin(viewer) || viewer?.id === user.id ? user.name : maskName(user.name);
}

function pricing(auction: Auction, viewer?: Viewer) {
  return {
    startingPrice: auction.startingPrice,
    currentPrice: auction.currentPrice,
    minimumIncrement: auction.minimumIncrement,
    minimumNextBid: minimumNextBid(auction),
    bidCount: auction.bidCount,
    hasReserve: auction.reservePrice !== null,
    // Buyers learn only whether the reserve is met, never its value.
    reserveMet: auction.reservePrice === null ? null : (auction.currentPrice ?? 0) >= auction.reservePrice,
    ...(isAdmin(viewer) ? { reservePrice: auction.reservePrice } : {}),
  };
}

export function toAuctionSummaryDto(record: AuctionSummaryRecord, viewer?: Viewer) {
  return {
    id: record.id,
    status: record.status,
    outcome: record.outcome,
    ...pricing(record, viewer),
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    extensionCount: record.extensionCount,
    winnerId: record.winnerId,
    highestBidder: record.highestBidder
      ? { id: record.highestBidder.id, name: publicName(record.highestBidder, viewer) }
      : null,
    bike: {
      id: record.bike.id,
      title: record.bike.title,
      brand: record.bike.brand,
      model: record.bike.model,
      year: record.bike.year,
      engineCC: record.bike.engineCC,
      kilometers: record.bike.kilometers,
      owners: record.bike.owners,
      location: record.bike.location,
      coverImageUrl: record.bike.images[0]?.url ?? null,
    },
  };
}

export type AuctionSummaryDto = ReturnType<typeof toAuctionSummaryDto>;

/** Compact public state broadcast to every client in an auction room. */
export function toAuctionState(record: AuctionSummaryRecord): AuctionStatePayload {
  return {
    auctionId: record.id,
    status: record.status,
    currentPrice: record.currentPrice,
    minimumNextBid: minimumNextBid(record),
    bidCount: record.bidCount,
    highestBidder: record.highestBidder
      ? { id: record.highestBidder.id, name: maskName(record.highestBidder.name) }
      : null,
    endsAt: record.endsAt,
    outcome: record.outcome,
    winnerId: record.winnerId,
  };
}

export function toAuctionDetailDto(record: AuctionDetailRecord, viewer: Viewer | undefined, isWatching: boolean) {
  return {
    id: record.id,
    status: record.status,
    outcome: record.outcome,
    ...pricing(record, viewer),
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    cancelReason: record.cancelReason,
    extensionCount: record.extensionCount,
    version: record.version,
    watcherCount: record._count.watchers,
    isWatching,
    highestBidder: record.highestBidder
      ? { id: record.highestBidder.id, name: publicName(record.highestBidder, viewer) }
      : null,
    winner: record.winner
      ? {
          id: record.winner.id,
          name: publicName(record.winner, viewer),
          ...(isAdmin(viewer) ? { email: record.winner.email } : {}),
        }
      : null,
    bike: toBikeDto(record.bike),
    createdAt: record.createdAt,
  };
}

export type AuctionDetailDto = ReturnType<typeof toAuctionDetailDto>;

export const toImageDto = (image: BikeImage) => ({ id: image.id, url: image.url, position: image.position });

export function toBikeDto(bike: BikeWithImages) {
  return {
    id: bike.id,
    title: bike.title,
    brand: bike.brand,
    model: bike.model,
    year: bike.year,
    engineCC: bike.engineCC,
    kilometers: bike.kilometers,
    owners: bike.owners,
    location: bike.location,
    description: bike.description,
    images: bike.images.map(toImageDto),
    createdAt: bike.createdAt,
  };
}

export function toBidDto(bid: BidWithBidder, viewer?: Viewer) {
  return {
    id: bid.id,
    auctionId: bid.auctionId,
    amount: bid.amount,
    createdAt: bid.createdAt,
    bidder: { id: bid.bidder.id, name: publicName(bid.bidder, viewer) },
  };
}

export type BidDto = ReturnType<typeof toBidDto>;

export const toNotificationDto = (n: Notification) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  auctionId: n.auctionId,
  readAt: n.readAt,
  createdAt: n.createdAt,
});

export type NotificationDto = ReturnType<typeof toNotificationDto>;
