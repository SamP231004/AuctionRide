'use client';

import { CalendarClock, Gavel, Radio, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { StatCard } from '@/components/shared/page-elements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Countdown } from '@/features/auctions/components/auction-meta';
import { formatINR, formatNumber, formatRelative } from '@/lib/utils';
import { useAdminDashboard } from '../api';

// Charting is the heaviest dependency in the app — load it only when the overview renders.
const Analytics = dynamic(() => import('./admin-analytics').then((m) => m.Analytics), {
  ssr: false,
  loading: () => <Skeleton className="h-96" />,
});

export function AdminOverview() {
  const { data, isPending } = useAdminDashboard();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending || !data ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Live now" value={data.counts.live} icon={Radio} />
            <StatCard label="Scheduled" value={data.counts.scheduled} icon={CalendarClock} hint={`${data.counts.draft} drafts`} />
            <StatCard label="Bids (24h)" value={formatNumber(data.counts.bidsLast24h)} icon={Gavel} />
            <StatCard label="Buyers" value={formatNumber(data.counts.buyers)} icon={Users} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live auctions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data?.liveAuctions.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No auctions are live.</p>}
            {data?.liveAuctions.map((a) => (
              <Link key={a.id} href={`/admin/auctions/${a.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.bike.title}</p>
                  <p className="text-xs text-muted-foreground">{a.bidCount} bids</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular">{formatINR(a.currentPrice ?? a.startingPrice)}</p>
                  <Countdown to={a.endsAt} className="text-xs" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent bids</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data?.recentBids.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No bids yet.</p>}
            {data?.recentBids.map((bid) => (
              <Link key={bid.id} href={`/admin/auctions/${bid.auction.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-medium">{bid.bidder.name}</span> <span className="text-muted-foreground">on</span> {bid.auction.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelative(bid.createdAt)}</p>
                </div>
                <p className="text-sm font-semibold tabular">{formatINR(bid.amount)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Analytics />
    </div>
  );
}
