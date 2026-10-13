'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import type { AppNotification, AuctionSummary, MeSummary, Paged } from '@/types/api';

export type MyAuctionsFilter = 'active' | 'won' | 'lost' | 'all';

/** Personal queries only run once the session is known, so they never fire as anonymous. */
const useIsAuthed = () => useAuthStore((s) => s.status === 'authenticated');

export function useMeSummary() {
  return useQuery({
    queryKey: queryKeys.me.summary(),
    queryFn: async () => (await api.get<MeSummary>('/me/summary')).data,
    enabled: useIsAuthed(),
  });
}

export function useMyAuctions(filter: MyAuctionsFilter, page = 1) {
  return useQuery({
    queryKey: queryKeys.me.auctions(filter, page),
    queryFn: async (): Promise<Paged<AuctionSummary>> => {
      const { data, meta } = await api.get<AuctionSummary[]>('/me/auctions', { filter, page, limit: 12 });
      return { items: data, meta: meta! };
    },
    enabled: useIsAuthed(),
    placeholderData: keepPreviousData,
  });
}

export function useWatchlist(page = 1) {
  return useQuery({
    queryKey: queryKeys.me.watchlist(page),
    queryFn: async (): Promise<Paged<AuctionSummary>> => {
      const { data, meta } = await api.get<AuctionSummary[]>('/me/watchlist', { page, limit: 12 });
      return { items: data, meta: meta! };
    },
    enabled: useIsAuthed(),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.me.notifications(),
    queryFn: async () => {
      const { data, meta } = await api.get<AppNotification[]>('/me/notifications', { limit: 15 });
      return { items: data, unreadCount: meta?.unreadCount ?? 0 };
    },
    enabled: useIsAuthed(),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/me/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me.all }),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/me/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me.all }),
  });
}
