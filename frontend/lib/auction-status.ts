import type { AuctionOutcome, AuctionStatus } from '@/types/api';

export const STATUS_LABEL: Record<AuctionStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Upcoming',
  LIVE: 'Live',
  ENDED: 'Ended',
  ARCHIVED: 'Archived',
  CANCELLED: 'Cancelled',
};

export const OUTCOME_LABEL: Record<AuctionOutcome, string> = {
  SOLD: 'Sold',
  RESERVE_NOT_MET: 'Reserve not met',
  NO_BIDS: 'No bids',
};

export const isFinished = (status: AuctionStatus) => status === 'ENDED' || status === 'ARCHIVED' || status === 'CANCELLED';
