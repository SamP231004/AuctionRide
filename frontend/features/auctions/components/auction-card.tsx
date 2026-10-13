'use client';

import { motion } from 'framer-motion';
import { Gauge, MapPin, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatINR, formatNumber } from '@/lib/utils';
import type { AuctionSummary } from '@/types/api';
import { BikeImage, Countdown, StatusBadge } from './auction-meta';

export function AuctionCard({ auction, index = 0 }: { auction: AuctionSummary; index?: number }) {
  const userId = useAuthStore((s) => s.user?.id);
  const isLeading = Boolean(userId) && auction.highestBidder?.id === userId && auction.status === 'LIVE';
  const isWinner = auction.winnerId !== null && auction.winnerId === userId;
  const price = auction.currentPrice ?? auction.startingPrice;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
    >
      <Link
        href={`/auctions/${auction.id}`}
        className="group block overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="relative">
          <BikeImage src={auction.bike.coverImageUrl} alt={auction.bike.title} className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.03]" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <StatusBadge status={auction.status} outcome={auction.outcome} overlay />
            {isLeading && <span className="rounded-full bg-success px-2 py-0.5 text-xs font-medium text-white">You lead</span>}
            {isWinner && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                <Trophy className="size-3" /> Won
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {auction.bike.brand} · {auction.bike.year}
            </p>
            <h3 className="mt-1 line-clamp-1 font-semibold tracking-tight">{auction.bike.title}</h3>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Gauge className="size-3.5" /> {formatNumber(auction.bike.kilometers)} km
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {auction.bike.location}
            </span>
            <span>{auction.bike.engineCC} cc</span>
          </div>

          <div className="flex items-end justify-between border-t pt-3">
            <div>
              <p className="text-xs text-muted-foreground">{auction.currentPrice ? 'Current bid' : 'Starting at'}</p>
              <motion.p
                key={price}
                initial={{ scale: 1.08, color: 'var(--primary)' }}
                animate={{ scale: 1, color: 'var(--foreground)' }}
                transition={{ duration: 0.6 }}
                className="text-lg font-semibold tabular"
              >
                {formatINR(price)}
              </motion.p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{auction.bidCount} bids</p>
              {auction.status === 'LIVE' && <Countdown to={auction.endsAt} />}
              {auction.status === 'SCHEDULED' && <Countdown to={auction.startsAt} prefix="in" />}
              {auction.myHighestBid != null && (
                <p className={cn('text-xs', auction.isLeading ? 'text-success' : 'text-muted-foreground')}>
                  Your bid {formatINR(auction.myHighestBid)}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function AuctionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between border-t pt-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}
