import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-elements';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { MyAuctionsList } from '@/features/me/components/my-auctions';

export const metadata: Metadata = { title: 'Won auctions' };

export default function WonAuctionsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <RequireAuth role="BUYER">
        <PageHeader title="Won auctions" description="Congratulations! Our team contacts winners within 24 hours." />
        <MyAuctionsList filter="won" />
      </RequireAuth>
    </div>
  );
}
