'use client';

import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, Pagination } from '@/components/shared/page-elements';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatINR } from '@/lib/utils';
import { useWinners } from '../api';

export function WinnersTable() {
  const [page, setPage] = useState(1);
  const { data, isPending } = useWinners(page);

  if (isPending) return <Skeleton className="h-80" />;
  if (!data?.items.length) {
    return <EmptyState icon={Trophy} title="No winners yet" description="Sold auctions and their winners will appear here." />;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Bike</th>
              <th className="px-4 py-3 font-medium">Winner</th>
              <th className="px-4 py-3 text-right font-medium">Winning bid</th>
              <th className="px-4 py-3 text-right font-medium">Bids</th>
              <th className="px-4 py-3 font-medium">Ended</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((a) => (
              <tr key={a.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/auctions/${a.id}`} className="font-medium hover:underline">
                    {a.bike.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p>{a.winner?.name}</p>
                  <p className="text-xs text-muted-foreground">{a.winner?.email}</p>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular">{a.currentPrice ? formatINR(a.currentPrice) : '—'}</td>
                <td className="px-4 py-3 text-right tabular">{a.bidCount}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.endedAt ? formatDateTime(a.endedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
    </>
  );
}
