import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-elements';
import { Button } from '@/components/ui/button';
import { BikesTable } from '@/features/admin/components/bikes';

export const metadata: Metadata = { title: 'Bikes' };

export default function AdminBikesPage() {
  return (
    <>
      <PageHeader
        title="Bikes"
        description="Inventory available for auction."
        actions={
          <Button asChild>
            <Link href="/admin/bikes/new">
              <Plus /> Add bike
            </Link>
          </Button>
        }
      />
      <BikesTable />
    </>
  );
}
