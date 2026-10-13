import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-elements';
import { AuctionBrowser } from '@/features/auctions/components/auction-browser';

export const metadata: Metadata = { title: 'Upcoming auctions' };

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Upcoming auctions" description="Preview bikes and add them to your watchlist before bidding opens." />
      <Suspense>
        <AuctionBrowser status="SCHEDULED" defaultSort="starting_soon" />
      </Suspense>
    </div>
  );
}
