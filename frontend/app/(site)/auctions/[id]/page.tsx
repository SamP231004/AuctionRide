import type { Metadata } from 'next';
import { AuctionDetailView } from '@/features/auctions/components/auction-detail-view';

export const metadata: Metadata = { title: 'Auction' };

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <AuctionDetailView id={id} />
    </div>
  );
}
