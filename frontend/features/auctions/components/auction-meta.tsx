'use client';

import { Bike as BikeIcon, Clock } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useCountdown } from '@/hooks/use-countdown';
import { OUTCOME_LABEL, STATUS_LABEL } from '@/lib/auction-status';
import { cn } from '@/lib/utils';
import type { AuctionOutcome, AuctionStatus } from '@/types/api';

export function StatusBadge({ status, outcome }: { status: AuctionStatus; outcome?: AuctionOutcome | null }) {
  if (status === 'LIVE') {
    return (
      <Badge variant="live">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
        </span>
        Live
      </Badge>
    );
  }
  if ((status === 'ENDED' || status === 'ARCHIVED') && outcome) {
    return <Badge variant={outcome === 'SOLD' ? 'success' : 'secondary'}>{OUTCOME_LABEL[outcome]}</Badge>;
  }
  const variant = status === 'SCHEDULED' ? 'default' : status === 'CANCELLED' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

/** Compact countdown: "2d 04h", "04:12:09", turns urgent in the final minute. */
export function Countdown({ to, className, prefix }: { to: string; className?: string; prefix?: string }) {
  const { days, hours, minutes, seconds, totalMs, isOver } = useCountdown(to);
  const urgent = !isOver && totalMs < 60_000;
  const label = isOver
    ? 'Ending…'
    : days > 0
      ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-mono text-sm tabular', urgent && 'animate-pulse font-semibold text-destructive', className)}
      aria-live={urgent ? 'polite' : 'off'}
    >
      <Clock className="size-3.5 opacity-70" aria-hidden />
      {prefix && <span className="font-sans text-muted-foreground">{prefix}</span>}
      {label}
    </span>
  );
}

/** Bike photo with a branded fallback. Images are lazy-loaded below the fold. */
export function BikeImage({
  src,
  alt,
  className,
  priority = false,
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!src) {
    return (
      <div className={cn('relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-muted via-muted to-primary/10', className)}>
        <div className="absolute inset-0 bg-grid opacity-60" />
        <BikeIcon className="relative size-12 text-muted-foreground/50" strokeWidth={1.25} aria-hidden />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {/* Images come from the API host (or a CDN); skipping the optimiser keeps Docker/Vercel setups host-agnostic. */}
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized className="object-cover" />
    </div>
  );
}
