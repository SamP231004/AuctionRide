'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Eye, Gauge, Heart, MapPin, Trophy, Users, Wifi, WifiOff, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/shared/page-elements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_LABEL, isFinished } from '@/lib/auction-status';
import { cn, formatDateTime, formatINR, formatNumber } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import type { AuctionDetail } from '@/types/api';
import { useAuction, useToggleWatch } from '../api';
import { useAuctionRoom } from '../hooks/use-auction-room';
import { BikeImage, Countdown, StatusBadge } from './auction-meta';
import { BidHistory } from './bid-history';
import { BidPanel } from './bid-panel';

function Gallery({ auction }: { auction: AuctionDetail }) {
  const [active, setActive] = useState(0);
  const images = auction.bike.images;
  return (
    <div className="space-y-3">
      <BikeImage
        src={images[active]?.url}
        alt={auction.bike.title}
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="aspect-[16/10] rounded-xl border"
      />
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1}`}
              className={cn('w-24 shrink-0 overflow-hidden rounded-lg border-2 transition', index === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <BikeImage src={image.url} alt="" sizes="96px" className="aspect-[4/3]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Spec({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function PriceBlock({ auction }: { auction: AuctionDetail }) {
  const price = auction.currentPrice ?? auction.startingPrice;
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {auction.currentPrice ? (isFinished(auction.status) ? 'Final bid' : 'Current bid') : 'Starting price'}
      </p>
      <motion.p
        key={price}
        initial={{ scale: 1.06, color: 'var(--primary)' }}
        animate={{ scale: 1, color: 'var(--foreground)' }}
        transition={{ duration: 0.7 }}
        className="text-4xl font-semibold tracking-tight tabular"
      >
        {formatINR(price)}
      </motion.p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{auction.bidCount} bids</span>
        {auction.highestBidder && <span>· leader {auction.highestBidder.name}</span>}
        {auction.hasReserve && (
          <Badge variant={auction.reserveMet ? 'success' : 'outline'}>{auction.reserveMet ? 'Reserve met' : 'Reserve not met'}</Badge>
        )}
        {!auction.hasReserve && <Badge variant="outline">No reserve</Badge>}
      </div>
    </div>
  );
}

function Outcome({ auction }: { auction: AuctionDetail }) {
  const userId = useAuthStore((s) => s.user?.id);
  if (auction.status === 'CANCELLED') {
    return <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">This auction was cancelled{auction.cancelReason ? `: ${auction.cancelReason}` : '.'}</p>;
  }
  if (!isFinished(auction.status)) return null;
  if (auction.winner?.id && auction.winner.id === userId) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4 text-primary">
        <Trophy className="size-5" />
        <div>
          <p className="font-semibold">You won this auction!</p>
          <p className="text-sm opacity-80">Our team will reach out to complete the purchase.</p>
        </div>
      </div>
    );
  }
  const text =
    auction.outcome === 'SOLD'
      ? `Sold to ${auction.winner?.name ?? 'the highest bidder'}`
      : auction.outcome === 'RESERVE_NOT_MET'
        ? 'Ended without meeting the reserve price'
        : 'Ended with no bids';
  return <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{text}.</p>;
}

export function AuctionDetailView({ id }: { id: string }) {
  const { data: auction, isPending, error } = useAuction(id);
  const { connected } = useAuctionRoom(id);
  const toggleWatch = useToggleWatch(id);
  const status = useAuthStore((s) => s.status);

  if (isPending) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <Skeleton className="aspect-[16/10] rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !auction) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <EmptyState
        icon={Wrench}
        title={notFound ? 'Auction not found' : 'Something went wrong'}
        description={notFound ? 'It may have been removed or never existed.' : 'Please try again in a moment.'}
        action={
          <Button asChild variant="outline">
            <Link href="/auctions">Browse auctions</Link>
          </Button>
        }
      />
    );
  }

  const { bike } = auction;
  return (
    <div>
      <Link href="/auctions" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All auctions
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-8">
          <Gallery auction={auction} />

          <div>
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {bike.brand} · {bike.model}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{bike.title}</h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Spec icon={Calendar} label="Year" value={String(bike.year)} />
            <Spec icon={Gauge} label="Odometer" value={`${formatNumber(bike.kilometers)} km`} />
            <Spec icon={Wrench} label="Engine" value={`${bike.engineCC} cc`} />
            <Spec icon={Users} label="Owners" value={String(bike.owners)} />
          </div>

          <div>
            <h2 className="mb-2 font-semibold">About this bike</h2>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" /> {bike.location}
            </p>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{bike.description}</p>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardContent className="space-y-5 pt-5">
              <div className="flex items-center justify-between">
                <StatusBadge status={auction.status} outcome={auction.outcome} />
                <span
                  className={cn('inline-flex items-center gap-1.5 text-xs', connected ? 'text-success' : 'text-muted-foreground')}
                  title={connected ? 'Receiving live updates' : 'Reconnecting…'}
                >
                  {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
                  {connected ? 'Live updates' : 'Offline'}
                </span>
              </div>

              <PriceBlock auction={auction} />

              {auction.status === 'LIVE' && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Ends in</span>
                  <Countdown to={auction.endsAt} className="text-base" />
                </div>
              )}
              {auction.status === 'SCHEDULED' && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Starts in</span>
                  <Countdown to={auction.startsAt} className="text-base" />
                </div>
              )}
              {auction.extensionCount > 0 && auction.status === 'LIVE' && (
                <p className="text-xs text-muted-foreground">Extended {auction.extensionCount}× by late bids.</p>
              )}

              <BidPanel auction={auction} />
              <Outcome auction={auction} />

              {status === 'authenticated' && !isFinished(auction.status) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => toggleWatch.mutate(!auction.isWatching)}
                  aria-pressed={auction.isWatching}
                >
                  <Heart className={cn(auction.isWatching && 'fill-primary text-primary')} />
                  {auction.isWatching ? 'Watching' : 'Watch auction'}
                </Button>
              )}

              <dl className="grid grid-cols-2 gap-y-2 border-t pt-4 text-xs">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-right">{STATUS_LABEL[auction.status]}</dd>
                <dt className="text-muted-foreground">Starts</dt>
                <dd className="text-right">{formatDateTime(auction.startsAt)}</dd>
                <dt className="text-muted-foreground">Ends</dt>
                <dd className="text-right">{formatDateTime(auction.endsAt)}</dd>
                <dt className="text-muted-foreground">Increment</dt>
                <dd className="text-right">{formatINR(auction.minimumIncrement)}</dd>
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="size-3" /> Watchers
                </dt>
                <dd className="text-right">{auction.watcherCount}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bid history</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[420px] overflow-y-auto px-2">
              <BidHistory auctionId={auction.id} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
