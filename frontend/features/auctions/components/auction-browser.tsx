'use client';

import { Gavel, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState, Pagination } from '@/components/shared/page-elements';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounce';
import type { AuctionSort, AuctionStatus } from '@/types/api';
import { useAuctions, useBrands } from '../api';
import { useAuctionsFeed } from '../hooks/use-auction-room';
import { AuctionCard, AuctionCardSkeleton } from './auction-card';

const SORT_OPTIONS: { value: AuctionSort; label: string }[] = [
  { value: 'ending_soon', label: 'Ending soonest' },
  { value: 'starting_soon', label: 'Starting soonest' },
  { value: 'newest', label: 'Newly listed' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'most_bids', label: 'Most bids' },
];

/**
 * Searchable, filterable auction grid. Filters live in the URL so results are shareable and
 * survive reloads; the search box is debounced to avoid a request per keystroke.
 */
export function AuctionBrowser({ status, defaultSort = 'ending_soon' }: { status?: AuctionStatus; defaultSort?: AuctionSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim());
  const brand = params.get('brand') ?? '';
  const sort = (params.get('sort') as AuctionSort | null) ?? defaultSort;
  const page = Number(params.get('page') ?? '1') || 1;

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in updates)) next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (debouncedSearch !== (params.get('q') ?? '')) setParams({ q: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced value
  }, [debouncedSearch]);

  useAuctionsFeed();
  const brands = useBrands();
  const { data, isPending, isError, refetch, isFetching } = useAuctions({
    status,
    q: debouncedSearch || undefined,
    brand: brand || undefined,
    sort,
    page,
    limit: 12,
  });

  const hasFilters = Boolean(debouncedSearch || brand);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by model, brand or city…"
            className="pl-9"
            aria-label="Search auctions"
          />
        </div>
        <NativeSelect value={brand} onChange={(e) => setParams({ brand: e.target.value || null })} aria-label="Filter by brand" className="md:w-48">
          <option value="">All brands</option>
          {brands.data?.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={sort} onChange={(e) => setParams({ sort: e.target.value })} aria-label="Sort auctions" className="md:w-52">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setParams({ q: null, brand: null });
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>

      {isError ? (
        <EmptyState icon={Gavel} title="Couldn't load auctions" description="Please check your connection." action={<Button onClick={() => refetch()}>Try again</Button>} />
      ) : isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <AuctionCardSkeleton key={i} />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={hasFilters ? 'No matching auctions' : 'Nothing here yet'}
          description={hasFilters ? 'Try a different search or clear the filters.' : 'New bikes are listed every week — check back soon.'}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {data.meta.total} {data.meta.total === 1 ? 'auction' : 'auctions'}
            {isFetching && ' · updating…'}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((auction, index) => (
              <AuctionCard key={auction.id} auction={auction} index={index} />
            ))}
          </div>
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={(p) => setParams({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
