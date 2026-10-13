'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth-store';
import type { Role } from '@/types/api';

/**
 * Client-side route guard. This is a UX layer only — every API call is authorised server-side,
 * so nothing sensitive is exposed if this guard is bypassed.
 */
export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { status, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === 'authenticated' && role && user?.role !== role) {
      router.replace(user?.role === 'ADMIN' ? '/admin' : '/dashboard');
    }
  }, [status, user, role, router, pathname]);

  if (status !== 'authenticated' || (role && user?.role !== role)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  return <>{children}</>;
}
