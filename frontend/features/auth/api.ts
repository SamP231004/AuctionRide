'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import type { Session, User } from '@/types/api';
import type { LoginInput, ProfileInput, RegisterInput } from './schemas';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => (await api.post<Session>('/auth/login', input)).data,
    onSuccess: (session) => {
      setSession(session);
      // Personalised data (isWatching, masked names) differs per user.
      queryClient.removeQueries();
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterInput) => (await api.post<Session>('/auth/register', input)).data,
    onSuccess: (session) => {
      setSession(session);
      queryClient.removeQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => queryClient.clear(),
  });
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: ProfileInput) => (await api.patch<User>('/me', input)).data,
    onSuccess: setUser,
  });
}
