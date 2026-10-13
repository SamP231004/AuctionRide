'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { getSocket, reconnectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth-store';
import type { AppNotification } from '@/types/api';

/**
 * App-wide socket concerns:
 *  - reconnect when the signed-in identity changes, so the server joins the right user room
 *  - surface personal notifications (outbid, won, …) as toasts and refresh the related queries
 */
export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const status = useAuthStore((state) => state.status);
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (status === 'loading') return;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) reconnectSocket();
    previousUserId.current = userId;
  }, [status, userId]);

  useEffect(() => {
    const socket = getSocket();
    const onNotification = (notification: AppNotification) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.all });
      const show = notification.type === 'AUCTION_WON' ? toast.success : notification.type === 'OUTBID' ? toast.warning : toast.info;
      show(notification.title, {
        description: notification.body,
        action: notification.auctionId
          ? { label: 'View', onClick: () => router.push(`/auctions/${notification.auctionId}`) }
          : undefined,
      });
    };
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('notification:new', onNotification);
    };
  }, [queryClient, router]);

  return null;
}
