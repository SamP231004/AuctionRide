'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatINR, formatRelative, initials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useBids } from '../api';

/** Re-renders periodically so "2 minutes ago" stays truthful. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function BidHistory({ auctionId }: { auctionId: string }) {
  const { data: bids, isPending } = useBids(auctionId);
  const userId = useAuthStore((s) => s.user?.id);
  const now = useNow();

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (!bids || bids.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center text-sm text-muted-foreground">
        <History className="mb-2 size-5" />
        No bids yet — be the first.
      </div>
    );
  }

  return (
    <ol className="space-y-1" aria-label="Bid history">
      <AnimatePresence initial={false}>
        {bids.map((bid, index) => {
          const mine = bid.bidder.id === userId;
          return (
            <motion.li
              key={bid.id}
              layout
              initial={{ opacity: 0, y: -12, backgroundColor: 'color-mix(in oklch, var(--primary) 18%, transparent)' }}
              animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }}
              transition={{ duration: 0.8 }}
              className="flex items-center justify-between rounded-lg px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-xs font-semibold',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {initials(bid.bidder.name)}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {mine ? 'You' : bid.bidder.name}
                    {index === 0 && <span className="ml-2 text-xs font-normal text-success">Highest</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelative(bid.createdAt, now)}</p>
                </div>
              </div>
              <span className={cn('font-semibold tabular', index === 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {formatINR(bid.amount)}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
