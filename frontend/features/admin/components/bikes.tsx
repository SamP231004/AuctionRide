'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Bike as BikeIcon, ImagePlus, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/shared/form-field';
import { EmptyState, Pagination } from '@/components/shared/page-elements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BikeImage, StatusBadge } from '@/features/auctions/components/auction-meta';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { formatINR, formatNumber } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import type { BikeDetail } from '@/types/api';
import { useBikes, useDeleteBike, useDeleteImage, useSaveBike, useUploadImages } from '../api';
import { bikeSchema, type BikeFormValues } from '../schemas';

const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : 'Something went wrong');

export function BikesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const { data, isPending } = useBikes({ q: q || undefined, page });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search bikes…" className="pl-9" aria-label="Search bikes" />
      </div>
      {isPending ? (
        <Skeleton className="h-80" />
      ) : !data?.items.length ? (
        <EmptyState icon={BikeIcon} title="No bikes yet" description="Add a bike to start creating auctions." action={<Button asChild><Link href="/admin/bikes/new"><Plus /> Add bike</Link></Button>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Bike</th>
                <th className="px-4 py-3 font-medium">Specs</th>
                <th className="px-4 py-3 font-medium">Photos</th>
                <th className="px-4 py-3 font-medium">Auction</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((bike) => (
                <tr key={bike.id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/bikes/${bike.id}`} className="flex items-center gap-3">
                      <BikeImage src={bike.images[0]?.url} alt="" sizes="64px" className="h-10 w-16 shrink-0 rounded-md" />
                      <span>
                        <span className="block font-medium hover:underline">{bike.title}</span>
                        <span className="text-xs text-muted-foreground">{bike.brand} · {bike.location}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {bike.year} · {bike.engineCC}cc · {formatNumber(bike.kilometers)} km
                  </td>
                  <td className="px-4 py-3 tabular">{bike.images.length > 0 ? bike.images.length : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    {bike.activeAuction ? (
                      <Link href={`/admin/auctions/${bike.activeAuction.id}`}>
                        <StatusBadge status={bike.activeAuction.status} />
                      </Link>
                    ) : (
                      <Link href={`/admin/auctions/new?bikeId=${bike.id}`} className="text-xs text-primary hover:underline">
                        Create auction
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />}
    </div>
  );
}

const FIELDS: { name: keyof BikeFormValues; label: string; type?: string; placeholder?: string }[] = [
  { name: 'brand', label: 'Brand', placeholder: 'Royal Enfield' },
  { name: 'model', label: 'Model', placeholder: 'Classic 350' },
  { name: 'year', label: 'Year', type: 'number' },
  { name: 'engineCC', label: 'Engine (cc)', type: 'number' },
  { name: 'kilometers', label: 'Kilometers', type: 'number' },
  { name: 'owners', label: 'Owners', type: 'number' },
  { name: 'location', label: 'Location', placeholder: 'Bengaluru' },
];

export function BikeForm({ bike }: { bike?: BikeDetail }) {
  const router = useRouter();
  const save = useSaveBike(bike?.id);
  const form = useForm<BikeFormValues>({
    resolver: zodResolver(bikeSchema),
    defaultValues: bike ?? { title: '', brand: '', model: '', year: new Date().getFullYear() - 2, engineCC: 350, kilometers: 0, owners: 1, location: '', description: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync(values);
      toast.success(bike ? 'Bike updated' : 'Bike created — now add some photos');
      if (!bike) router.push(`/admin/bikes/${saved.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField id="title" label="Listing title" error={errors.title?.message} className="sm:col-span-2">
            <Input id="title" placeholder="Royal Enfield Classic 350 — Signals Edition" aria-invalid={!!errors.title} aria-describedby="title-message" {...form.register('title')} />
          </FormField>
          {FIELDS.map((field) => (
            <FormField key={field.name} id={field.name} label={field.label} error={errors[field.name]?.message}>
              <Input id={field.name} type={field.type} placeholder={field.placeholder} aria-invalid={!!errors[field.name]} aria-describedby={`${field.name}-message`} {...form.register(field.name)} />
            </FormField>
          ))}
          <FormField id="description" label="Description" error={errors.description?.message} className="sm:col-span-2">
            <Textarea id="description" rows={5} placeholder="Condition, service history, modifications…" aria-invalid={!!errors.description} aria-describedby="description-message" {...form.register('description')} />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" loading={save.isPending}>
              {bike ? 'Save changes' : 'Create bike'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function BikeImages({ bike }: { bike: BikeDetail }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImages(bike.id);
  const remove = useDeleteImage(bike.id);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      await upload.mutateAsync(Array.from(files));
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Photos</CardTitle>
          <CardDescription>JPEG, PNG or WebP · up to 5 MB each · first photo is the cover</CardDescription>
        </div>
        <Button variant="outline" size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
          <ImagePlus /> Upload
        </Button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
      </CardHeader>
      <CardContent>
        {bike.images.length === 0 ? (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center rounded-lg border border-dashed py-10 text-sm text-muted-foreground hover:bg-muted/30">
            <ImagePlus className="mb-2 size-6" /> Add photos of the bike
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {bike.images.map((image, index) => (
              <div key={image.id} className="group relative">
                <BikeImage src={image.url} alt={`Photo ${index + 1}`} sizes="200px" className="aspect-[4/3] rounded-lg border" />
                {index === 0 && <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Cover</span>}
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 size-7 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete photo ${index + 1}`}
                  onClick={() => remove.mutate(image.id, { onError: (e) => toast.error(errorMessage(e)) })}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BikeAuctions({ bike }: { bike: BikeDetail }) {
  const router = useRouter();
  const remove = useDeleteBike();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Auctions</CardTitle>
        <Button size="sm" asChild>
          <Link href={`/admin/auctions/new?bikeId=${bike.id}`}>
            <Plus /> New auction
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {bike.auctions.length === 0 && <p className="text-sm text-muted-foreground">This bike has not been auctioned yet.</p>}
        {bike.auctions.map((a) => (
          <Link key={a.id} href={`/admin/auctions/${a.id}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/30">
            <StatusBadge status={a.status} outcome={a.outcome} />
            <span className="text-muted-foreground">{a.bidCount} bids</span>
            <span className="tabular">{a.currentPrice ? formatINR(a.currentPrice) : '—'}</span>
          </Link>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-destructive hover:text-destructive"
          onClick={async () => {
            if (!window.confirm('Delete this bike permanently?')) return;
            try {
              await remove.mutateAsync(bike.id);
              toast.success('Bike deleted');
              router.push('/admin/bikes');
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          <Trash2 /> Delete bike
        </Button>
      </CardContent>
    </Card>
  );
}
