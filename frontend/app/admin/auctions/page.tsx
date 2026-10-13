import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-elements';
import { AuctionsTable, NewAuctionButton } from '@/features/admin/components/auctions';

export const metadata: Metadata = { title: 'Auctions' };

export default function AdminAuctionsPage() {
  return (
    <>
      <PageHeader title="Auctions" description="Schedule, monitor and close auctions." actions={<NewAuctionButton />} />
      <AuctionsTable />
    </>
  );
}
