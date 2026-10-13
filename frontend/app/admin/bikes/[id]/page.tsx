import type { Metadata } from 'next';
import { BikeEditor } from '@/features/admin/components/bike-editor';

export const metadata: Metadata = { title: 'Edit bike' };

export default async function EditBikePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BikeEditor id={id} />;
}
