'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { syncServerTime } from '@/lib/server-time';
import { api } from '@/services/api-client';
import type {
  AuctionDetail,
  AuctionSort,
  AuctionState,
  AuctionStatus,
  AuctionSummary,
  Bid,
  BidPlacedEvent,
  Paged,
} from '@/types/api';

export interface AuctionListParams {
  status?: AuctionStatus;
  q?: string;
  brand?: string;
  sort?: AuctionSort;
  page?: number;
  limit?: number;
}

export function useAuctions(params: AuctionListParams) {
  return useQuery({
    queryKey: queryKeys.auctions.list({ ...params }),
    queryFn: async ({ signal }): Promise<Paged<AuctionSummary>> => {
      const { data, meta } = await api.get<AuctionSummary[]>('/auctions', { ...params }, signal);
      syncServerTime(meta?.serverTime);
      return { items: data, meta: meta! };
    },
    placeholderData: keepPreviousData,
  });
}

export function useAuction(id: string) {
  return useQuery({
    queryKey: queryKeys.auctions.detail(id),
    queryFn: async ({ signal }) => {
      const { data, meta } = await api.get<AuctionDetail>(`/auctions/${id}`, undefined, signal);
      syncServerTime(meta?.serverTime);
      return data;
    },
  });
}

export function useBids(id: string) {
  return useQuery({
    queryKey: queryKeys.auctions.bids(id),
    queryFn: async ({ signal }) => (await api.get<Bid[]>(`/auctions/${id}/bids`, { limit: 25 }, signal)).data,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: queryKeys.auctions.brands(),
    queryFn: async () => (await api.get<string[]>('/auctions/brands')).data,
    staleTime: 5 * 60_000,
  });
}

// ─── Cache patching (shared by socket events and mutation responses) ─────────

type StatePatch = Omit<AuctionState, 'serverTime'>;

function patchAuction<T extends AuctionSummary | AuctionDetail>(auction: T, state: StatePatch): T {
  return {
    ...auction,
    status: state.status,
    currentPrice: state.currentPrice,
    minimumNextBid: state.minimumNextBid,
    bidCount: state.bidCount,
    highestBidder: state.highestBidder,
    endsAt: state.endsAt,
    outcome: state.outcome,
    ...('winnerId' in auction ? { winnerId: state.winnerId } : {}),
    // Admins know the reserve and can recompute; buyers get the fresh flag via refetch.
    reserveMet:
      auction.reservePrice != null ? (state.currentPrice ?? 0) >= auction.reservePrice : auction.reserveMet,
  };
}

/** Writes a pushed auction state into every cached view of that auction. */
export function applyAuctionState(queryClient: QueryClient, state: StatePatch) {
  queryClient.setQueryData<AuctionDetail>(queryKeys.auctions.detail(state.auctionId), (current) => {
    if (!current) return current;
    const statusChanged = current.status !== state.status;
    // Reserve status and winner identity are only known server-side → refetch on transitions.
    if (statusChanged || (current.hasReserve && current.reserveMet === false)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(state.auctionId) });
    }
    return patchAuction(current, state);
  });

  queryClient.setQueriesData<Paged<AuctionSummary>>({ queryKey: queryKeys.auctions.lists() }, (current) =>
    current
      ? { ...current, items: current.items.map((item) => (item.id === state.auctionId ? patchAuction(item, state) : item)) }
      : current,
  );
}

export function applyBidPlaced(queryClient: QueryClient, event: Pick<BidPlacedEvent, 'bid' | 'auction'>) {
  applyAuctionState(queryClient, event.auction);
  queryClient.setQueryData<Bid[]>(queryKeys.auctions.bids(event.auction.auctionId), (current) => {
    if (!current) return current;
    if (current.some((bid) => bid.id === event.bid.id)) return current;
    return [event.bid, ...current].slice(0, 50);
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function usePlaceBid(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) =>
      (await api.post<{ bid: Bid; auction: StatePatch }>(`/auctions/${auctionId}/bids`, { amount })).data,
    onSuccess: (result) => {
      applyBidPlaced(queryClient, result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.all });
    },
  });
}

export function useToggleWatch(auctionId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.auctions.detail(auctionId);
  return useMutation({
    mutationFn: (watch: boolean) =>
      watch ? api.post(`/auctions/${auctionId}/watch`) : api.delete(`/auctions/${auctionId}/watch`),
    // Optimistic: flip immediately, roll back on failure.
    onMutate: async (watch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AuctionDetail>(key);
      if (previous) {
        queryClient.setQueryData<AuctionDetail>(key, {
          ...previous,
          isWatching: watch,
          watcherCount: previous.watcherCount + (watch ? 1 : -1),
        });
      }
      return { previous };
    },
    onError: (_error, _watch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.all });
    },
  });
}
