'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { syncServerTime } from '@/lib/server-time';
import { formatINR } from '@/lib/utils';
import { getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth-store';
import type { AuctionState, BidPlacedEvent } from '@/types/api';
import { applyAuctionState, applyBidPlaced } from '../api';

/**
 * Joins the auction's socket room and streams updates into the TanStack Query cache.
 * Returns whether the live connection is up so the UI can show a "live" indicator.
 */
export function useAuctionRoom(auctionId: string) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const join = () => {
      socket.emit('auction:join', auctionId);
      setConnected(true);
      // Anything could have happened while we were disconnected — resync once.
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.bids(auctionId) });
    };
    const onDisconnect = () => setConnected(false);

    const onBid = (event: BidPlacedEvent) => {
      if (event.auctionId !== auctionId) return;
      syncServerTime(event.serverTime);
      applyBidPlaced(queryClient, event);
      const me = useAuthStore.getState().user?.id;
      if (event.bid.bidder.id !== me) {
        toast(`New bid: ${formatINR(event.bid.amount)}`, {
          description: event.extended ? 'Bid in the final minute — auction extended.' : `by ${event.bid.bidder.name}`,
          duration: 2500,
        });
      }
    };

    const onUpdated = (state: AuctionState) => {
      if (state.auctionId !== auctionId) return;
      syncServerTime(state.serverTime);
      applyAuctionState(queryClient, state);
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('bid:placed', onBid);
    socket.on('auction:updated', onUpdated);

    return () => {
      socket.emit('auction:leave', auctionId);
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('bid:placed', onBid);
      socket.off('auction:updated', onUpdated);
    };
  }, [auctionId, queryClient]);

  return { connected };
}

/** Keeps listing pages live: prices, bid counts and status changes stream into cached lists. */
export function useAuctionsFeed() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const subscribe = () => socket.emit('auctions:subscribe');
    const onUpdated = (state: AuctionState) => {
      syncServerTime(state.serverTime);
      applyAuctionState(queryClient, state);
    };

    if (socket.connected) subscribe();
    socket.on('connect', subscribe);
    socket.on('auction:updated', onUpdated);
    return () => {
      socket.emit('auctions:unsubscribe');
      socket.off('connect', subscribe);
      socket.off('auction:updated', onUpdated);
    };
  }, [queryClient]);
}
