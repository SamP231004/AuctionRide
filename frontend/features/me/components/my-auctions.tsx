'use client';

import { Gavel, Heart, Trophy, TrendingDown, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, Pagination, StatCard } from '@/components/shared/page-elements';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuctionCard, AuctionCardSkeleton } from '@/features/auctions/components/auction-card';
import type { AuctionSummary, Paged } from '@/types/api';
import { useMeSummary, useMyAuctions, useWatchlist, type MyAuctionsFilter } from '../api';

function AuctionList({
  query,
  page,
  onPageChange,
  empty,
}: {
  query: { data?: Paged<AuctionSummary>; isPending: boolean };
  page: number;
  onPageChange: (page: number) => void;
  empty: { title: string; description: string };
}) {
  if (query.isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <AuctionCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (!query.data?.items.length) {
    return (
      <EmptyState
        icon={Gavel}
        {...empty}
        action={
          <Button asChild variant="outline">
            <Link href="/auctions/live">Browse live auctions</Link>
          </Button>
        }
      />
    );
  }
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {query.data.items.map((auction, index) => (
          <AuctionCard key={auction.id} auction={auction} index={index} />
        ))}
      </div>
      <Pagination page={page} totalPages={query.data.meta.totalPages} onPageChange={onPageChange} />
    </>
  );
}

const EMPTY: Record<MyAuctionsFilter | 'watching', { title: string; description: string }> = {
  active: { title: 'No active bids', description: 'Auctions you bid on appear here while they are live.' },
  won: { title: 'No wins yet', description: 'When you win an auction it will show up here.' },
  lost: { title: 'Nothing here', description: 'Ended auctions you bid on but did not win.' },
  all: { title: 'No bids yet', description: 'Your bidding history will appear here.' },
  watching: { title: 'Your watchlist is empty', description: 'Watch upcoming auctions to get notified when they go live.' },
};

export function MyAuctionsList({ filter }: { filter: MyAuctionsFilter }) {
  const [page, setPage] = useState(1);
  const query = useMyAuctions(filter, page);
  return <AuctionList query={query} page={page} onPageChange={setPage} empty={EMPTY[filter]} />;
}

function WatchlistList() {
  const [page, setPage] = useState(1);
  const query = useWatchlist(page);
  return <AuctionList query={query} page={page} onPageChange={setPage} empty={EMPTY.watching} />;
}

export function BuyerDashboard() {
  const summary = useMeSummary();
  const [tab, setTab] = useState<'active' | 'watching' | 'won' | 'lost'>('active');

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Active bids" value={summary.data?.activeBids ?? 0} icon={Zap} hint="Live auctions you're in" />
            <StatCard label="Watching" value={summary.data?.watching ?? 0} icon={Heart} />
            <StatCard label="Won" value={summary.data?.won ?? 0} icon={Trophy} />
            <StatCard label="Lost" value={summary.data?.lost ?? 0} icon={TrendingDown} />
          </>
        )}
      </div>

      <div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="mb-6">
          <TabsList>
            <TabsTrigger value="active">Active bids</TabsTrigger>
            <TabsTrigger value="watching">Watchlist</TabsTrigger>
            <TabsTrigger value="won">Won</TabsTrigger>
            <TabsTrigger value="lost">Lost</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'watching' ? <WatchlistList /> : <MyAuctionsList key={tab} filter={tab} />}
      </div>
    </div>
  );
}
