import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuctionManager } from '@/features/admin/components/auctions';

export const metadata: Metadata = { title: 'Manage auction' };

export default async function ManageAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AuctionManager id={id} />
    </Suspense>
  );
}
