import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  buildTestApp,
  createAdmin,
  db,
  login,
  registerBuyer,
  resetDatabase,
  sampleBike,
  type TestContext,
} from './helpers.js';

interface AuctionBody {
  data: { id: string; status: string; currentPrice: number | null; outcome: string | null; winner: { id: string } | null };
}

describe('auction lifecycle and bidding (integration)', () => {
  let ctx: TestContext;
  let adminToken: string;
  let alice: { token: string; id: string };
  let bob: { token: string; id: string };

  beforeEach(async () => {
    await resetDatabase();
    ctx = buildTestApp();
    await createAdmin();
    adminToken = await login(ctx.app, 'admin@test.dev');
    alice = await registerBuyer(ctx.app, 'Alice Verma', 'alice@test.dev');
    bob = await registerBuyer(ctx.app, 'Bob Nair', 'bob@test.dev');
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function createLiveAuction(overrides: Record<string, unknown> = {}): Promise<string> {
    const bike = await request(ctx.app).post('/api/bikes').set(bearer(adminToken)).send(sampleBike).expect(201);
    const now = Date.now();
    const auction = await request(ctx.app)
      .post('/api/auctions')
      .set(bearer(adminToken))
      .send({
        bikeId: (bike.body as { data: { id: string } }).data.id,
        startingPrice: 100_000,
        minimumIncrement: 1_000,
        startsAt: new Date(now + 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
        ...overrides,
      })
      .expect(201);
    const id = (auction.body as AuctionBody).data.id;
    await request(ctx.app).post(`/api/auctions/${id}/publish`).set(bearer(adminToken)).expect(200);
    await request(ctx.app).post(`/api/auctions/${id}/start`).set(bearer(adminToken)).expect(200);
    return id;
  }

  const bid = (id: string, token: string, amount: number) =>
    request(ctx.app).post(`/api/auctions/${id}/bids`).set(bearer(token)).send({ amount });

  it('runs an auction from draft to sold, broadcasting and notifying along the way', async () => {
    const id = await createLiveAuction({ reservePrice: 105_000 });
    expect(ctx.scheduler.jobs.map((job) => job.name)).toEqual(['start', 'end']);

    await bid(id, alice.token, 100_000).expect(201);
    await bid(id, bob.token, 105_000).expect(201);

    expect(ctx.realtime.bids).toHaveLength(2);
    expect(ctx.realtime.bids[1]?.auction).toMatchObject({ currentPrice: 105_000, bidCount: 2, minimumNextBid: 106_000 });
    expect(ctx.realtime.notifications).toContainEqual({ userId: alice.id, type: 'OUTBID' });

    const ended = await request(ctx.app).post(`/api/auctions/${id}/end`).set(bearer(adminToken)).expect(200);
    expect((ended.body as AuctionBody).data).toMatchObject({ status: 'ENDED', outcome: 'SOLD', winner: { id: bob.id } });
    expect(ctx.realtime.notifications).toContainEqual({ userId: bob.id, type: 'AUCTION_WON' });
    expect(ctx.realtime.notifications).toContainEqual({ userId: alice.id, type: 'AUCTION_LOST' });

    const won = await request(ctx.app).get('/api/me/auctions?filter=won').set(bearer(bob.token)).expect(200);
    expect((won.body as { data: { id: string }[] }).data.map((a) => a.id)).toEqual([id]);

    // Ended auctions are immutable.
    await bid(id, alice.token, 200_000).expect(422);
    await request(ctx.app).post(`/api/auctions/${id}/start`).set(bearer(adminToken)).expect(409);
  });

  it('enforces bidding rules', async () => {
    const id = await createLiveAuction();

    const tooLow = await bid(id, alice.token, 99_000).expect(422);
    expect((tooLow.body as { error: { code: string } }).error.code).toBe('BID_TOO_LOW');

    await bid(id, alice.token, 100_000).expect(201);
    const self = await bid(id, alice.token, 110_000).expect(422);
    expect((self.body as { error: { code: string } }).error.code).toBe('ALREADY_HIGHEST_BIDDER');

    const increment = await bid(id, bob.token, 100_500).expect(422);
    expect((increment.body as { error: { details: unknown } }).error.details).toEqual({ minimumBid: 101_000 });

    // Admins cannot bid; anonymous users cannot bid.
    await bid(id, adminToken, 150_000).expect(403);
    await request(ctx.app).post(`/api/auctions/${id}/bids`).send({ amount: 150_000 }).expect(401);
  });

  it('accepts exactly one of many concurrent bids at the same amount', async () => {
    const id = await createLiveAuction();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => bid(id, i % 2 === 0 ? alice.token : bob.token, 100_000)),
    );
    expect(results.filter((res) => res.status === 201)).toHaveLength(1);

    const auction = await db.auction.findUniqueOrThrow({ where: { id } });
    expect(auction.bidCount).toBe(1);
    expect(await db.bid.count({ where: { auctionId: id } })).toBe(1);
  });

  it('rejects bids once the end time has passed, even before the end job runs', async () => {
    const id = await createLiveAuction();
    ctx.clock.advance(2 * 3_600_000);
    const res = await bid(id, alice.token, 100_000).expect(422);
    expect((res.body as { error: { code: string } }).error.code).toBe('AUCTION_ENDED');
  });

  it('extends the auction when a bid lands in the soft-close window', async () => {
    const id = await createLiveAuction();
    const { endsAt } = await db.auction.findUniqueOrThrow({ where: { id } });
    ctx.clock.advance(endsAt.getTime() - Date.now() - 30_000); // 30s before the end

    await bid(id, alice.token, 100_000).expect(201);
    const after = await db.auction.findUniqueOrThrow({ where: { id } });
    expect(after.endsAt.getTime()).toBeGreaterThan(endsAt.getTime());
    expect(after.extensionCount).toBe(1);
    expect(ctx.scheduler.jobs.at(-1)).toMatchObject({ name: 'end', auctionId: id });
  });

  it('reconciles overdue auctions and declares RESERVE_NOT_MET', async () => {
    const id = await createLiveAuction({ reservePrice: 500_000 });
    await bid(id, alice.token, 100_000).expect(201);
    ctx.clock.advance(2 * 3_600_000);

    const counts = await ctx.container.services.lifecycle.reconcile();
    expect(counts.ended).toBe(1);
    const auction = await db.auction.findUniqueOrThrow({ where: { id } });
    expect(auction).toMatchObject({ status: 'ENDED', outcome: 'RESERVE_NOT_MET', winnerId: null });
  });

  it('hides drafts and reserve prices from buyers', async () => {
    const bike = await request(ctx.app).post('/api/bikes').set(bearer(adminToken)).send(sampleBike).expect(201);
    const draft = await request(ctx.app)
      .post('/api/auctions')
      .set(bearer(adminToken))
      .send({
        bikeId: (bike.body as { data: { id: string } }).data.id,
        startingPrice: 100_000,
        reservePrice: 150_000,
        minimumIncrement: 1_000,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .expect(201);
    const id = (draft.body as AuctionBody).data.id;

    await request(ctx.app).get(`/api/auctions/${id}`).set(bearer(alice.token)).expect(404);
    await request(ctx.app).post(`/api/auctions/${id}/publish`).set(bearer(adminToken)).expect(200);

    const asBuyer = await request(ctx.app).get(`/api/auctions/${id}`).set(bearer(alice.token)).expect(200);
    expect(asBuyer.body).toMatchObject({ data: { hasReserve: true, reserveMet: false } });
    expect((asBuyer.body as { data: object }).data).not.toHaveProperty('reservePrice');
  });
});
