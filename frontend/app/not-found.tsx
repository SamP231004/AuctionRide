import { Compass } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="pointer-events-none absolute inset-0 bg-glow" />
      <Compass className="relative mb-6 size-10 text-primary" strokeWidth={1.5} />
      <p className="relative font-mono text-sm text-muted-foreground">404</p>
      <h1 className="relative mt-2 text-3xl font-semibold tracking-tight">Wrong turn</h1>
      <p className="relative mt-2 max-w-sm text-muted-foreground">This road doesn&apos;t lead anywhere. The page may have moved or never existed.</p>
      <div className="relative mt-8 flex gap-3">
        <Button asChild>
          <Link href="/auctions/live">Live auctions</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
