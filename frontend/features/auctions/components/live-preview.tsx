'use client';

import { Gavel } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/page-elements';
import { Button } from '@/components/ui/button';
import { useAuctions } from '../api';
import { useAuctionsFeed } from '../hooks/use-auction-room';
import { AuctionCard, AuctionCardSkeleton } from './auction-card';

/** Landing-page strip of the auctions closing next; falls back to upcoming when nothing is live. */
export function LiveAuctionsPreview() {
  useAuctionsFeed();
  const live = useAuctions({ status: 'LIVE', sort: 'ending_soon', limit: 3 });
  const upcoming = useAuctions({ status: 'SCHEDULED', sort: 'starting_soon', limit: 3 });

  if (live.isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <AuctionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const items = live.data?.items.length ? live.data.items : (upcoming.data?.items ?? []);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Gavel}
        title="No auctions right now"
        description="New bikes are listed every week."
        action={
          <Button asChild variant="outline">
            <Link href="/auctions">See past auctions</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((auction, index) => (
        <AuctionCard key={auction.id} auction={auction} index={index} />
      ))}
    </div>
  );
}
