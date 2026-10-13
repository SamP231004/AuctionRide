import type { Metadata } from 'next';
import { SiteHeader } from '@/components/shared/site-header';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { RequireAuth } from '@/features/auth/components/require-auth';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · AuctionRide' } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[200px_1fr]">
        <AdminNav />
        <main className="min-w-0">
          <RequireAuth role="ADMIN">{children}</RequireAuth>
        </main>
      </div>
    </div>
  );
}
