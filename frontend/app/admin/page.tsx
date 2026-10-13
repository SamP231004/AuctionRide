import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-elements';
import { AdminOverview } from '@/features/admin/components/admin-overview';
import { NewAuctionButton } from '@/features/admin/components/auctions';

export const metadata: Metadata = { title: 'Overview' };

export default function AdminHomePage() {
  return (
    <>
      <PageHeader title="Overview" description="Live activity and marketplace performance." actions={<NewAuctionButton />} />
      <AdminOverview />
    </>
  );
}
