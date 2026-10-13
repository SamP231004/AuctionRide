/** DTOs returned by the AuctionRide API. Kept in sync with backend/src/services/mappers.ts. */

export type Role = 'ADMIN' | 'BUYER';
export type AuctionStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'ARCHIVED' | 'CANCELLED';
export type AuctionOutcome = 'SOLD' | 'RESERVE_NOT_MET' | 'NO_BIDS';
export type AuctionSort = 'ending_soon' | 'starting_soon' | 'newest' | 'price_asc' | 'price_desc' | 'most_bids';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  serverTime?: string;
  unreadCount?: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface BikeImage {
  id: string;
  url: string;
  position: number;
}

export interface Bike {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  engineCC: number;
  kilometers: number;
  owners: number;
  location: string;
  description: string;
  images: BikeImage[];
  createdAt: string;
}

export interface BikeListItem extends Bike {
  auctionCount: number;
  activeAuction: { id: string; status: AuctionStatus } | null;
}

export interface BikeDetail extends Bike {
  auctions: {
    id: string;
    status: AuctionStatus;
    startsAt: string;
    endsAt: string;
    currentPrice: number | null;
    bidCount: number;
    outcome: AuctionOutcome | null;
  }[];
}

interface AuctionPricing {
  startingPrice: number;
  currentPrice: number | null;
  minimumIncrement: number;
  minimumNextBid: number;
  bidCount: number;
  hasReserve: boolean;
  reserveMet: boolean | null;
  /** Admins only. */
  reservePrice?: number | null;
}

export interface AuctionSummary extends AuctionPricing {
  id: string;
  status: AuctionStatus;
  outcome: AuctionOutcome | null;
  startsAt: string;
  endsAt: string;
  extensionCount: number;
  winnerId: string | null;
  highestBidder: PersonRef | null;
  bike: Omit<Bike, 'description' | 'images' | 'createdAt'> & { coverImageUrl: string | null };
  /** Present on "my auctions" endpoints. */
  myHighestBid?: number | null;
  isLeading?: boolean;
}

export interface AuctionDetail extends AuctionPricing {
  id: string;
  status: AuctionStatus;
  outcome: AuctionOutcome | null;
  startsAt: string;
  endsAt: string;
  startedAt: string | null;
  endedAt: string | null;
  cancelReason: string | null;
  extensionCount: number;
  version: number;
  watcherCount: number;
  isWatching: boolean;
  highestBidder: PersonRef | null;
  winner: (PersonRef & { email?: string }) | null;
  bike: Bike;
  createdAt: string;
}

export interface Bid {
  id: string;
  auctionId: string;
  amount: number;
  createdAt: string;
  bidder: PersonRef;
}

/** Compact state pushed over the socket after every change. */
export interface AuctionState {
  auctionId: string;
  status: AuctionStatus;
  currentPrice: number | null;
  minimumNextBid: number;
  bidCount: number;
  highestBidder: PersonRef | null;
  endsAt: string;
  outcome: AuctionOutcome | null;
  winnerId: string | null;
  serverTime: string;
}

export interface BidPlacedEvent {
  auctionId: string;
  bid: Bid;
  auction: Omit<AuctionState, 'serverTime'>;
  extended: boolean;
  serverTime: string;
}

export type NotificationType = 'OUTBID' | 'AUCTION_STARTED' | 'AUCTION_WON' | 'AUCTION_LOST' | 'AUCTION_CANCELLED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  auctionId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface MeSummary {
  activeBids: number;
  won: number;
  lost: number;
  watching: number;
  unreadNotifications: number;
}

export interface AdminDashboard {
  counts: { live: number; scheduled: number; draft: number; ended: number; buyers: number; bidsLast24h: number };
  grossValue: number;
  liveAuctions: AuctionSummary[];
  recentBids: { id: string; amount: number; createdAt: string; bidder: PersonRef; auction: { id: string; title: string } }[];
}

export interface AdminAnalytics {
  rangeDays: number;
  totals: { grossValue: number; averageSalePrice: number; averageBidsPerAuction: number; sellThroughRate: number };
  outcomes: { sold: number; reserveNotMet: number; noBids: number };
  bidsPerDay: { day: string; bids: number; bidders: number }[];
  salesPerDay: { day: string; sold: number; revenue: number }[];
  newUsersPerDay: { day: string; users: number }[];
  topAuctions: { id: string; title: string; bidCount: number; currentPrice: number | null; status: AuctionStatus }[];
  generatedAt: string;
}

export interface Session {
  user: User;
  accessToken: string;
  expiresIn: number;
}
