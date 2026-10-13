import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-elements';
import { AuctionBrowser } from '@/features/auctions/components/auction-browser';

export const metadata: Metadata = { title: 'All auctions' };

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="All auctions" description="Live, upcoming and recently closed motorcycle auctions." />
      <Suspense>
        <AuctionBrowser defaultSort="ending_soon" />
      </Suspense>
    </div>
  );
}
