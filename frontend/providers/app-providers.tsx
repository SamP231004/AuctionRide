'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/services/api-client';
import { AuthBootstrap } from './auth-bootstrap';
import { RealtimeBridge } from './realtime-bridge';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Client errors (404, 403, validation) will not fix themselves on retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap />
        <RealtimeBridge />
        {/* Honour the OS "reduce motion" setting for every animation. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Toaster richColors closeButton position="bottom-right" theme="system" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
