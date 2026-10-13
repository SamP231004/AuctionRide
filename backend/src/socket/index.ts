import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { SOCKET } from '../config/constants.js';
import { env } from '../config/env.js';
import type { NotificationDto } from '../services/mappers.js';
import type { TokenService } from '../services/token.service.js';
import type { AuthUser } from '../types/express.js';
import type { AuctionStatePayload, BidPlacedPayload, RealtimePublisher } from '../types/ports.js';
import { logger } from '../utils/logger.js';

/** Typed event contract shared (by convention) with the frontend's socket client. */
interface ServerToClientEvents {
  'bid:placed': (payload: BidPlacedPayload & { serverTime: string }) => void;
  'auction:updated': (payload: AuctionStatePayload & { serverTime: string }) => void;
  'notification:new': (payload: NotificationDto) => void;
}

interface ClientToServerEvents {
  'auction:join': (auctionId: unknown, ack?: (result: { ok: boolean; error?: string }) => void) => void;
  'auction:leave': (auctionId: unknown) => void;
  'auctions:subscribe': () => void;
  'auctions:unsubscribe': () => void;
}

interface SocketData {
  user: AuthUser | null;
}

export type AppSocketServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const auctionIdSchema = z.string().uuid();

export function createSocketServer(
  httpServer: HttpServer,
  deps: { tokens: TokenService; pubClient?: Redis; subClient?: Redis },
): AppSocketServer {
  const io: AppSocketServer = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    // Client sends at most a token and room ids; keep frames tiny.
    maxHttpBufferSize: 10_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Redis adapter: broadcasts reach sockets connected to *any* API replica.
  if (deps.pubClient && deps.subClient) {
    io.adapter(createAdapter(deps.pubClient, deps.subClient));
  }

  // Handshake auth is optional — anonymous visitors may watch auctions but get no user room.
  io.use((socket, next) => {
    const token: unknown = (socket.handshake.auth as Record<string, unknown> | undefined)?.token;
    socket.data.user = null;
    if (typeof token === 'string' && token.length > 0) {
      try {
        socket.data.user = deps.tokens.verifyAccessToken(token);
      } catch {
        // Expired token: connect anonymously; the client reconnects after refreshing.
      }
    }
    next();
  });

  io.on('connection', (socket: AppSocket) => {
    const user = socket.data.user;
    if (user) void socket.join(SOCKET.rooms.user(user.id));
    logger.debug({ socketId: socket.id, userId: user?.id }, 'Socket connected');

    socket.on('auction:join', (rawId, ack) => {
      const parsed = auctionIdSchema.safeParse(rawId);
      if (!parsed.success) return ack?.({ ok: false, error: 'INVALID_AUCTION_ID' });

      const joinedAuctionRooms = [...socket.rooms].filter((room) => room.startsWith('auction:')).length;
      if (joinedAuctionRooms >= SOCKET.MAX_AUCTION_ROOMS_PER_SOCKET) {
        return ack?.({ ok: false, error: 'TOO_MANY_ROOMS' });
      }
      void socket.join(SOCKET.rooms.auction(parsed.data));
      ack?.({ ok: true });
    });

    socket.on('auction:leave', (rawId) => {
      const parsed = auctionIdSchema.safeParse(rawId);
      if (parsed.success) void socket.leave(SOCKET.rooms.auction(parsed.data));
    });

    socket.on('auctions:subscribe', () => void socket.join(SOCKET.rooms.auctionsFeed));
    socket.on('auctions:unsubscribe', () => void socket.leave(SOCKET.rooms.auctionsFeed));

    socket.on('disconnect', (reason) => logger.debug({ socketId: socket.id, reason }, 'Socket disconnected'));
  });

  return io;
}

/** RealtimePublisher adapter over Socket.IO rooms. */
export class SocketIoPublisher implements RealtimePublisher {
  constructor(private readonly io: AppSocketServer) {}

  bidPlaced(payload: BidPlacedPayload): void {
    const serverTime = new Date().toISOString();
    this.io.to(SOCKET.rooms.auction(payload.auctionId)).emit('bid:placed', { ...payload, serverTime });
    // Listing pages only need the compact state.
    this.io.to(SOCKET.rooms.auctionsFeed).emit('auction:updated', { ...payload.auction, serverTime });
  }

  auctionUpdated(payload: AuctionStatePayload): void {
    const event = { ...payload, serverTime: new Date().toISOString() };
    this.io.to([SOCKET.rooms.auction(payload.auctionId), SOCKET.rooms.auctionsFeed]).emit('auction:updated', event);
  }

  notify(userId: string, notification: NotificationDto): void {
    this.io.to(SOCKET.rooms.user(userId)).emit('notification:new', notification);
  }
}

/** Used in tests and before the socket server exists. */
export class NoopPublisher implements RealtimePublisher {
  bidPlaced(): void {}
  auctionUpdated(): void {}
  notify(): void {}
}
