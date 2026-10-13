import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-elements';
import { AuctionBrowser } from '@/features/auctions/components/auction-browser';

export const metadata: Metadata = { title: 'Live auctions' };

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Live auctions" description="Bidding is open — prices update in real time." />
      <Suspense>
        <AuctionBrowser status="LIVE" defaultSort="ending_soon" />
      </Suspense>
    </div>
  );
}
