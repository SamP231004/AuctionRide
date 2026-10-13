'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Ban, Gavel, Pencil, Play, Plus, Send, Square, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/shared/form-field';
import { EmptyState, Pagination } from '@/components/shared/page-elements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuction, useAuctions } from '@/features/auctions/api';
import { BikeImage, Countdown, StatusBadge } from '@/features/auctions/components/auction-meta';
import { BidHistory } from '@/features/auctions/components/bid-history';
import { useAuctionRoom } from '@/features/auctions/hooks/use-auction-room';
import { formatDateTime, formatINR } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import type { AuctionDetail, AuctionStatus } from '@/types/api';
import { useAuctionAction, useBikes, useCancelAuction, useDeleteAuction, useSaveAuction, type AuctionAction } from '../api';
import { auctionSchema, toAuctionPayload, toLocalInput, type AuctionFormValues } from '../schemas';

const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : 'Something went wrong');

const STATUS_TABS: { value: AuctionStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'LIVE', label: 'Live' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'ENDED', label: 'Ended' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function AuctionsTable() {
  const [status, setStatus] = useState<AuctionStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const { data, isPending } = useAuctions({ status: status === 'ALL' ? undefined : status, sort: 'newest', page, limit: 20 });

  return (
    <div className="space-y-4">
      <Tabs value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
        <TabsList className="h-auto flex-wrap">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {isPending ? (
        <Skeleton className="h-80" />
      ) : !data?.items.length ? (
        <EmptyState icon={Gavel} title="No auctions" description="Create an auction from one of your bikes." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Bike</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Bids</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/auctions/${a.id}`} className="font-medium hover:underline">
                      {a.bike.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} outcome={a.outcome} />
                  </td>
                  <td className="px-4 py-3 text-right tabular">{formatINR(a.currentPrice ?? a.startingPrice)}</td>
                  <td className="px-4 py-3 text-right tabular">{a.bidCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.status === 'LIVE' ? <Countdown to={a.endsAt} className="text-xs" /> : `${formatDateTime(a.startsAt)} → ${formatDateTime(a.endsAt)}`}
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

export function AuctionForm({ auction, onSaved }: { auction?: AuctionDetail; onSaved?: () => void }) {
  const router = useRouter();
  const presetBike = useSearchParams().get('bikeId') ?? '';
  const bikes = useBikes({ page: 1 });
  const save = useSaveAuction(auction ? { id: auction.id, version: auction.version } : undefined);

  const now = Date.now();
  const form = useForm<AuctionFormValues>({
    resolver: zodResolver(auctionSchema),
    defaultValues: auction
      ? {
          bikeId: auction.bike.id,
          startingPrice: auction.startingPrice,
          reservePrice: auction.reservePrice ?? '',
          minimumIncrement: auction.minimumIncrement,
          startsAt: toLocalInput(auction.startsAt),
          endsAt: toLocalInput(auction.endsAt),
        }
      : {
          bikeId: presetBike,
          startingPrice: 100000,
          reservePrice: '',
          minimumIncrement: 1000,
          startsAt: toLocalInput(new Date(now + 60 * 60_000)),
          endsAt: toLocalInput(new Date(now + 25 * 60 * 60_000)),
        },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync(toAuctionPayload(auctionSchema.parse(values)));
      toast.success(auction ? 'Auction updated' : 'Draft auction created');
      if (onSaved) onSaved();
      else router.push(`/admin/auctions/${saved.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const availableBikes = bikes.data?.items.filter((b) => !b.activeAuction || b.id === auction?.bike.id) ?? [];

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <FormField id="bikeId" label="Bike" error={errors.bikeId?.message} className="sm:col-span-2">
        <NativeSelect id="bikeId" disabled={!!auction} aria-invalid={!!errors.bikeId} {...form.register('bikeId')}>
          <option value="">Select a bike…</option>
          {availableBikes.map((bike) => (
            <option key={bike.id} value={bike.id}>
              {bike.title}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="startingPrice" label="Starting price (₹)" error={errors.startingPrice?.message}>
        <Input id="startingPrice" type="number" aria-invalid={!!errors.startingPrice} aria-describedby="startingPrice-message" {...form.register('startingPrice')} />
      </FormField>
      <FormField id="minimumIncrement" label="Minimum increment (₹)" error={errors.minimumIncrement?.message}>
        <Input id="minimumIncrement" type="number" aria-invalid={!!errors.minimumIncrement} aria-describedby="minimumIncrement-message" {...form.register('minimumIncrement')} />
      </FormField>
      <FormField id="reservePrice" label="Reserve price (₹, optional)" error={errors.reservePrice?.message} hint="Hidden from buyers. Leave empty for no reserve.">
        <Input id="reservePrice" type="number" aria-invalid={!!errors.reservePrice} aria-describedby="reservePrice-message" {...form.register('reservePrice')} />
      </FormField>
      <div className="hidden sm:block" />
      <FormField id="startsAt" label="Starts" error={errors.startsAt?.message}>
        <Input id="startsAt" type="datetime-local" aria-invalid={!!errors.startsAt} aria-describedby="startsAt-message" {...form.register('startsAt')} />
      </FormField>
      <FormField id="endsAt" label="Ends" error={errors.endsAt?.message}>
        <Input id="endsAt" type="datetime-local" aria-invalid={!!errors.endsAt} aria-describedby="endsAt-message" {...form.register('endsAt')} />
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" loading={save.isPending}>
          {auction ? 'Save changes' : 'Create draft'}
        </Button>
      </div>
    </form>
  );
}

function CancelDialog({ auctionId, open, onOpenChange }: { auctionId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = useState('');
  const cancel = useCancelAuction(auctionId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel auction?</DialogTitle>
          <DialogDescription>Bidders and watchers are notified with your reason. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Seller withdrew the listing" aria-label="Cancellation reason" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep auction
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3}
            loading={cancel.isPending}
            onClick={async () => {
              try {
                await cancel.mutateAsync(reason.trim());
                toast.success('Auction cancelled');
                onOpenChange(false);
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            Cancel auction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACTIONS: Partial<Record<AuctionStatus, { action: AuctionAction; label: string; icon: typeof Play; confirm?: string }[]>> = {
  DRAFT: [{ action: 'publish', label: 'Publish', icon: Send }],
  SCHEDULED: [
    { action: 'start', label: 'Start now', icon: Play, confirm: 'Start this auction immediately?' },
    { action: 'unpublish', label: 'Unpublish', icon: Undo2 },
  ],
  LIVE: [{ action: 'end', label: 'End now', icon: Square, confirm: 'End this auction now? The current leader wins if the reserve is met.' }],
};

export function AuctionManager({ id }: { id: string }) {
  const router = useRouter();
  const { data: auction, isPending } = useAuction(id);
  useAuctionRoom(id);
  const runAction = useAuctionAction(id);
  const remove = useDeleteAuction();
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isPending || !auction) return <Skeleton className="h-96" />;

  const editable = auction.status === 'DRAFT' || auction.status === 'SCHEDULED';
  const cancellable = editable || auction.status === 'LIVE';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <BikeImage src={auction.bike.images[0]?.url} alt="" sizes="96px" className="h-14 w-20 shrink-0 rounded-lg border" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{auction.bike.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={auction.status} outcome={auction.outcome} />
              <Link href={`/auctions/${auction.id}`} className="text-xs text-muted-foreground hover:underline">
                View public page
              </Link>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTIONS[auction.status]?.map(({ action, label, icon: Icon, confirm }) => (
            <Button
              key={action}
              variant={action === 'unpublish' ? 'outline' : 'default'}
              loading={runAction.isPending && runAction.variables === action}
              onClick={async () => {
                if (confirm && !window.confirm(confirm)) return;
                try {
                  await runAction.mutateAsync(action);
                  toast.success(`${label} — done`);
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <Icon /> {label}
            </Button>
          ))}
          {editable && (
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              <Pencil /> {editing ? 'Close editor' : 'Edit'}
            </Button>
          )}
          {cancellable && (
            <Button variant="outline" className="text-destructive" onClick={() => setCancelOpen(true)}>
              <Ban /> Cancel
            </Button>
          )}
          {auction.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete draft"
              onClick={async () => {
                if (!window.confirm('Delete this draft?')) return;
                try {
                  await remove.mutateAsync(auction.id);
                  toast.success('Draft deleted');
                  router.push('/admin/auctions');
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit auction</CardTitle>
          </CardHeader>
          <CardContent>
            <AuctionForm auction={auction} onSaved={() => setEditing(false)} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ['Current price', auction.currentPrice ? formatINR(auction.currentPrice) : '—'],
                ['Bids', String(auction.bidCount)],
                ['Starting price', formatINR(auction.startingPrice)],
                ['Reserve price', auction.reservePrice ? `${formatINR(auction.reservePrice)} ${auction.reserveMet ? '(met)' : '(not met)'}` : 'None'],
                ['Minimum increment', formatINR(auction.minimumIncrement)],
                ['Watchers', String(auction.watcherCount)],
                ['Starts', formatDateTime(auction.startsAt)],
                ['Ends', formatDateTime(auction.endsAt)],
                ['Leader', auction.highestBidder?.name ?? '—'],
                ['Winner', auction.winner ? `${auction.winner.name}${auction.winner.email ? ` · ${auction.winner.email}` : ''}` : '—'],
                ['Soft-close extensions', String(auction.extensionCount)],
                ...(auction.cancelReason ? [['Cancel reason', auction.cancelReason]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b pb-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bid history</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[480px] overflow-y-auto px-2">
            <BidHistory auctionId={auction.id} />
          </CardContent>
        </Card>
      </div>

      <CancelDialog auctionId={auction.id} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  );
}

export function NewAuctionButton() {
  return (
    <Button asChild>
      <Link href="/admin/auctions/new">
        <Plus /> New auction
      </Link>
    </Button>
  );
}
