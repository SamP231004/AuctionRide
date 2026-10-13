import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-elements';
import { Card, CardContent } from '@/components/ui/card';
import { AuctionForm } from '@/features/admin/components/auctions';

export const metadata: Metadata = { title: 'New auction' };

export default function NewAuctionPage() {
  return (
    <>
      <PageHeader title="New auction" description="Auctions start as drafts. Publish to schedule — they go live automatically at the start time." />
      <Card>
        <CardContent className="pt-5">
          <Suspense>
            <AuctionForm />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
