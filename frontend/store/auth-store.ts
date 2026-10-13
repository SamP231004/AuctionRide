import { create } from 'zustand';
import type { User } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Kept in memory only — never persisted to storage (XSS cannot lift it after a reload). */
  accessToken: string | null;
  setSession: (session: { user: User; accessToken: string }) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

/**
 * Client-side session state. This is genuinely client state (a credential + bootstrap status),
 * so it lives in Zustand; everything fetched from the API lives in TanStack Query.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => set({ status: 'authenticated', user, accessToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ status: 'unauthenticated', user: null, accessToken: null }),
}));
