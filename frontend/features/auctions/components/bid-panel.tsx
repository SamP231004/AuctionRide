'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Gavel, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatINR } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import type { AuctionDetail } from '@/types/api';
import { usePlaceBid } from '../api';

function bidSchema(minimum: number) {
  return z.object({
    amount: z.coerce
      .number({ invalid_type_error: 'Enter an amount' })
      .int('Whole rupees only')
      .min(minimum, `Minimum bid is ${formatINR(minimum)}`),
  });
}

export function BidPanel({ auction }: { auction: AuctionDetail }) {
  const { user, status } = useAuthStore();
  const pathname = usePathname();
  const placeBid = usePlaceBid(auction.id);
  const minimum = auction.minimumNextBid;
  const schema = useMemo(() => bidSchema(minimum), [minimum]);

  const form = useForm<{ amount: number }>({ resolver: zodResolver(schema), defaultValues: { amount: minimum } });

  // When someone else bids, move the suggested amount up (unless the user already typed more).
  useEffect(() => {
    if (Number(form.getValues('amount')) < minimum) form.setValue('amount', minimum);
  }, [minimum, form]);

  const isLeading = user && auction.highestBidder?.id === user.id;
  const quickBids = [minimum, minimum + auction.minimumIncrement * 2, minimum + auction.minimumIncrement * 5];

  const onSubmit = form.handleSubmit(async ({ amount }) => {
    try {
      await placeBid.mutateAsync(amount);
      toast.success(`Bid placed: ${formatINR(amount)}`, { description: "You're now the highest bidder." });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not place bid. Please try again.';
      form.setError('amount', { message });
    }
  });

  if (auction.status !== 'LIVE') return null;

  if (status !== 'authenticated') {
    return (
      <div className="rounded-xl border bg-muted/40 p-5 text-center">
        <p className="text-sm text-muted-foreground">Sign in to place a bid.</p>
        <Button asChild className="mt-3 w-full">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in to bid</Link>
        </Button>
      </div>
    );
  }

  if (user?.role === 'ADMIN') {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="size-4" /> Admins can monitor but not bid.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <AnimatePresence>
        {isLeading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success"
          >
            <CheckCircle2 className="size-4" /> You&apos;re the highest bidder
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-2">
        {quickBids.map((amount) => (
          <Button key={amount} type="button" variant="outline" size="sm" className="tabular" onClick={() => form.setValue('amount', amount, { shouldValidate: true })}>
            {formatINR(amount)}
          </Button>
        ))}
      </div>

      <div>
        <label htmlFor="bid-amount" className="sr-only">
          Bid amount in rupees
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input
            id="bid-amount"
            type="number"
            inputMode="numeric"
            step={auction.minimumIncrement}
            min={minimum}
            className="h-11 pl-7 text-lg font-semibold tabular"
            aria-invalid={!!form.formState.errors.amount}
            aria-describedby="bid-amount-message"
            disabled={!!isLeading}
            {...form.register('amount')}
          />
        </div>
        <p id="bid-amount-message" className="mt-1.5 text-xs text-muted-foreground" role={form.formState.errors.amount ? 'alert' : undefined}>
          {form.formState.errors.amount?.message ? (
            <span className="text-destructive">{form.formState.errors.amount.message}</span>
          ) : (
            <>Minimum {formatINR(minimum)} · increments of {formatINR(auction.minimumIncrement)}</>
          )}
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={placeBid.isPending} disabled={!!isLeading}>
        <Gavel /> {isLeading ? 'Waiting for other bids' : 'Place bid'}
      </Button>
    </form>
  );
}
