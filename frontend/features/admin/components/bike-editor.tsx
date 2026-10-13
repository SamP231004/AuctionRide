'use client';

import { PageHeader } from '@/components/shared/page-elements';
import { Skeleton } from '@/components/ui/skeleton';
import { useBike } from '../api';
import { BikeAuctions, BikeForm, BikeImages } from './bikes';

export function BikeEditor({ id }: { id: string }) {
  const { data: bike, isPending, error } = useBike(id);
  if (isPending) return <Skeleton className="h-96" />;
  if (error || !bike) return <p className="text-sm text-muted-foreground">Bike not found.</p>;
  return (
    <>
      <PageHeader title={bike.title} description={`${bike.brand} · ${bike.model} · ${bike.year}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <BikeImages bike={bike} />
          <BikeForm key={bike.id} bike={bike} />
        </div>
        <div>
          <BikeAuctions bike={bike} />
        </div>
      </div>
    </>
  );
}
