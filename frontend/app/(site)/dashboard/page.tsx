import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-elements';
import { RequireAuth } from '@/features/auth/components/require-auth';
import { BuyerDashboard } from '@/features/me/components/my-auctions';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <RequireAuth role="BUYER">
        <PageHeader title="Your garage" description="Track your bids, watchlist and wins in one place." />
        <BuyerDashboard />
      </RequireAuth>
    </div>
  );
}
