import bcrypt from 'bcrypt';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/config/database.js';
import { createContainer, type Container } from '../../src/container.js';
import type { AuctionScheduler, AuctionStatePayload, BidPlacedPayload, RealtimePublisher } from '../../src/types/ports.js';
import type { Clock } from '../../src/utils/time.js';

export const db = createPrismaClient();

/** Records scheduled jobs instead of talking to Redis. */
export class FakeScheduler implements AuctionScheduler {
  jobs: { name: string; auctionId: string; at: Date }[] = [];
  scheduleStart = (auctionId: string, at: Date) => this.push('start', auctionId, at);
  scheduleEnd = (auctionId: string, at: Date) => this.push('end', auctionId, at);
  scheduleArchive = (auctionId: string, at: Date) => this.push('archive', auctionId, at);
  cancel = (auctionId: string) => {
    this.jobs = this.jobs.filter((job) => job.auctionId !== auctionId);
    return Promise.resolve();
  };
  private push(name: string, auctionId: string, at: Date) {
    this.jobs.push({ name, auctionId, at });
    return Promise.resolve();
  }
}

/** Captures real-time events for assertions. */
export class RecordingPublisher implements RealtimePublisher {
  bids: BidPlacedPayload[] = [];
  updates: AuctionStatePayload[] = [];
  notifications: { userId: string; type: string }[] = [];
  bidPlaced(payload: BidPlacedPayload) {
    this.bids.push(payload);
  }
  auctionUpdated(payload: AuctionStatePayload) {
    this.updates.push(payload);
  }
  notify(userId: string, notification: { type: string }) {
    this.notifications.push({ userId, type: notification.type });
  }
}

/** Clock the tests can move forward to simulate auctions ending. */
export class FakeClock implements Clock {
  private offsetMs = 0;
  now() {
    return new Date(Date.now() + this.offsetMs);
  }
  advance(ms: number) {
    this.offsetMs += ms;
  }
}

export interface TestContext {
  app: Express;
  container: Container;
  scheduler: FakeScheduler;
  realtime: RecordingPublisher;
  clock: FakeClock;
}

export function buildTestApp(): TestContext {
  const scheduler = new FakeScheduler();
  const realtime = new RecordingPublisher();
  const clock = new FakeClock();
  const container = createContainer({ db, scheduler, realtime, clock, rateLimiting: false });
  return { app: createApp(container), container, scheduler, realtime, clock };
}

export async function resetDatabase(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE audit_logs, notifications, watchlist, bids, auctions, bike_images, bikes, refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
}

export const PASSWORD = 'Password123';

export async function createAdmin(email = 'admin@test.dev') {
  return db.user.create({
    data: { name: 'Admin', email, role: 'ADMIN', passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
}

export async function login(app: Express, email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

export async function registerBuyer(app: Express, name: string, email: string): Promise<{ token: string; id: string }> {
  const res = await request(app).post('/api/auth/register').send({ name, email, password: PASSWORD }).expect(201);
  const body = res.body as { data: { accessToken: string; user: { id: string } } };
  return { token: body.data.accessToken, id: body.data.user.id };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const sampleBike = {
  title: 'Royal Enfield Himalayan 450',
  brand: 'Royal Enfield',
  model: 'Himalayan 450',
  year: 2024,
  engineCC: 452,
  kilometers: 3200,
  owners: 1,
  location: 'Bengaluru',
  description: 'Adventure tourer in excellent condition with full service history.',
};
