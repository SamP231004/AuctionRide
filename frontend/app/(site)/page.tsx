import { ArrowRight, BadgeCheck, Radio, ShieldCheck, Timer } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { LiveAuctionsPreview } from '@/features/auctions/components/live-preview';

const FEATURES = [
  {
    icon: Radio,
    title: 'Truly live bidding',
    body: 'Every bid reaches every bidder in milliseconds. No refreshing, no surprises.',
  },
  {
    icon: Timer,
    title: 'Fair closing',
    body: 'Late bids extend the clock, so auctions are won by the best offer — not the fastest sniper.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified listings',
    body: 'Every motorcycle is inspected, with full specs, odometer readings and ownership history.',
  },
  {
    icon: BadgeCheck,
    title: 'Transparent reserves',
    body: 'See instantly whether the seller’s reserve has been met. What you bid is what you pay.',
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-glow" />
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <Link
            href="/auctions/live"
            className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition hover:text-foreground"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-destructive" />
            </span>
            Auctions are live right now
            <ArrowRight className="size-3" />
          </Link>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Your next motorcycle,{' '}
            <span className="bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">won in real time.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground text-balance sm:text-lg">
            Bid on inspected, pre-owned bikes from riders across India. Live prices, fair closing and complete
            transparency — from Royal Enfields to superbikes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/auctions/live">
                Browse live auctions <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">Create free account</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Ending soon</h2>
            <p className="text-sm text-muted-foreground">Prices update live as bids come in.</p>
          </div>
          <Link href="/auctions/live" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <Suspense>
          <LiveAuctionsPreview />
        </Suspense>
      </section>

      <section className="border-t bg-muted/20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border bg-background">
                <feature.icon className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
