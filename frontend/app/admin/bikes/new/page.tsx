import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-elements';
import { BikeForm } from '@/features/admin/components/bikes';

export const metadata: Metadata = { title: 'Add bike' };

export default function NewBikePage() {
  return (
    <>
      <PageHeader title="Add bike" description="Photos can be added after the bike is created." />
      <BikeForm />
    </>
  );
}
