import { io, type Socket } from 'socket.io-client';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth-store';
import type { AppNotification, AuctionState, BidPlacedEvent } from '@/types/api';

interface ServerToClientEvents {
  'bid:placed': (payload: BidPlacedEvent) => void;
  'auction:updated': (payload: AuctionState) => void;
  'notification:new': (payload: AppNotification) => void;
}

interface ClientToServerEvents {
  'auction:join': (auctionId: string, ack?: (result: { ok: boolean; error?: string }) => void) => void;
  'auction:leave': (auctionId: string) => void;
  'auctions:subscribe': () => void;
  'auctions:unsubscribe': () => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * One shared connection per tab. The auth payload is a function, so every (re)connect sends the
 * *current* access token; callers re-join their rooms on `connect`.
 */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(env.socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? undefined }),
    });
  }
  return socket;
}

/** Reconnect so the server sees the new identity after login / logout / token refresh. */
export function reconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}
