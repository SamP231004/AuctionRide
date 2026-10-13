import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-elements';
import { WinnersTable } from '@/features/admin/components/winners';

export const metadata: Metadata = { title: 'Winners' };

export default function WinnersPage() {
  return (
    <>
      <PageHeader title="Winners" description="Sold auctions awaiting fulfilment." />
      <WinnersTable />
    </>
  );
}
