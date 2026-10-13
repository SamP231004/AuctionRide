'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/services/api-client';
import type { AdminAnalytics, AdminDashboard, AuctionDetail, Bike, BikeDetail, BikeImage, BikeListItem, Paged } from '@/types/api';
import type { AuctionFormOutput, BikeFormValues } from './schemas';

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: async () => (await api.get<AdminDashboard>('/admin/dashboard')).data,
    refetchInterval: 30_000,
  });
}

export function useAdminAnalytics(days: number) {
  return useQuery({
    queryKey: queryKeys.admin.analytics(days),
    queryFn: async () => (await api.get<AdminAnalytics>('/admin/analytics', { days })).data,
  });
}

export function useWinners(page: number) {
  return useQuery({
    queryKey: queryKeys.admin.winners(page),
    queryFn: async (): Promise<Paged<AuctionDetail>> => {
      const { data, meta } = await api.get<AuctionDetail[]>('/admin/winners', { page, limit: 20 });
      return { items: data, meta: meta! };
    },
    placeholderData: keepPreviousData,
  });
}

// ─── Bikes ───────────────────────────────────────────────────────────────────

export function useBikes(params: { q?: string; page: number }) {
  return useQuery({
    queryKey: queryKeys.admin.bikes(params),
    queryFn: async (): Promise<Paged<BikeListItem>> => {
      const { data, meta } = await api.get<BikeListItem[]>('/bikes', { ...params, limit: 20 });
      return { items: data, meta: meta! };
    },
    placeholderData: keepPreviousData,
  });
}

export function useBike(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.bike(id ?? ''),
    queryFn: async () => (await api.get<BikeDetail>(`/bikes/${id}`)).data,
    enabled: Boolean(id),
  });
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all });
  };
}

export function useSaveBike(id?: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (values: BikeFormValues) =>
      (id ? await api.patch<Bike>(`/bikes/${id}`, values) : await api.post<Bike>('/bikes', values)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteBike() {
  const invalidate = useInvalidateAdmin();
  return useMutation({ mutationFn: (id: string) => api.delete(`/bikes/${id}`), onSuccess: invalidate });
}

export function useUploadImages(bikeId: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append('images', file);
      return (await api.post<BikeImage[]>(`/bikes/${bikeId}/images`, form)).data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteImage(bikeId: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (imageId: string) => api.delete(`/bikes/${bikeId}/images/${imageId}`),
    onSuccess: invalidate,
  });
}

// ─── Auctions ────────────────────────────────────────────────────────────────

export function useSaveAuction(existing?: { id: string; version: number }) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (values: AuctionFormOutput) => {
      if (existing) {
        const { bikeId: _bikeId, ...changes } = values;
        return (await api.patch<AuctionDetail>(`/auctions/${existing.id}`, { ...changes, version: existing.version })).data;
      }
      return (await api.post<AuctionDetail>('/auctions', values)).data;
    },
    onSuccess: invalidate,
  });
}

export type AuctionAction = 'publish' | 'unpublish' | 'start' | 'end';

export function useAuctionAction(id: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (action: AuctionAction) => (await api.post<AuctionDetail>(`/auctions/${id}/${action}`)).data,
    onSuccess: invalidate,
  });
}

export function useCancelAuction(id: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (reason: string) => (await api.post<AuctionDetail>(`/auctions/${id}/cancel`, { reason })).data,
    onSuccess: invalidate,
  });
}

export function useDeleteAuction() {
  const invalidate = useInvalidateAdmin();
  return useMutation({ mutationFn: (id: string) => api.delete(`/auctions/${id}`), onSuccess: invalidate });
}
