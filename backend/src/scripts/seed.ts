/**
 * Idempotent development seed: an admin, two demo buyers and a handful of bikes/auctions across
 * every lifecycle state. Safe to run repeatedly — demo data is only created when no bikes exist.
 *
 *   npm run db:seed
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'admin@auctionride.dev').toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const BUYER_PASSWORD = 'Buyer@12345';

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

const BIKES = [
  { title: 'Royal Enfield Classic 350 — Signals Edition', brand: 'Royal Enfield', model: 'Classic 350', year: 2022, engineCC: 349, kilometers: 8400, owners: 1, location: 'Bengaluru', description: 'Single owner, all services at the authorised centre. New tyres at 7,000 km, includes crash guard and saddle stays. Insurance valid until next March.' },
  { title: 'KTM 390 Duke', brand: 'KTM', model: '390 Duke', year: 2021, engineCC: 373, kilometers: 15200, owners: 1, location: 'Pune', description: 'Well maintained street fighter with quick shifter, aftermarket tail tidy and full service history. Chain and sprockets replaced recently.' },
  { title: 'Yamaha R15 V4 — Racing Blue', brand: 'Yamaha', model: 'R15 V4', year: 2023, engineCC: 155, kilometers: 4100, owners: 1, location: 'Chennai', description: 'Practically new, garage kept. Traction control, quick shifter and dual-channel ABS. Comes with both keys and the original invoice.' },
  { title: 'Honda CB350 H\'ness DLX Pro', brand: 'Honda', model: 'CB350', year: 2022, engineCC: 348, kilometers: 11000, owners: 2, location: 'Hyderabad', description: 'Smooth retro cruiser with Honda Selectable Torque Control. Second owner, transferable warranty, minor scratch on the left side panel.' },
  { title: 'Kawasaki Ninja 650', brand: 'Kawasaki', model: 'Ninja 650', year: 2020, engineCC: 649, kilometers: 21000, owners: 1, location: 'Mumbai', description: 'Parallel twin sport tourer, frame sliders and tank pad fitted. Ridden mostly on highways, regular synthetic oil changes every 5,000 km.' },
  { title: 'Bajaj Dominar 400', brand: 'Bajaj', model: 'Dominar 400', year: 2021, engineCC: 373, kilometers: 26500, owners: 1, location: 'Delhi', description: 'Touring-ready with panniers, windscreen and auxiliary lamps. Mechanically sound, recently serviced with new brake pads.' },
  { title: 'TVS Apache RR 310', brand: 'TVS', model: 'Apache RR 310', year: 2022, engineCC: 312, kilometers: 9800, owners: 1, location: 'Kochi', description: 'Track-inspired faired bike with ride modes and bi-directional quick shifter. Never raced, always serviced at TVS.' },
];

async function main() {
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { name: 'AuctionRide Admin', email: ADMIN_EMAIL, passwordHash: adminHash, role: 'ADMIN' },
  });

  const buyerHash = await bcrypt.hash(BUYER_PASSWORD, 12);
  const [aarav, diya] = await Promise.all(
    [
      { name: 'Aarav Mehta', email: 'aarav@example.com' },
      { name: 'Diya Kapoor', email: 'diya@example.com' },
    ].map((buyer) =>
      prisma.user.upsert({ where: { email: buyer.email }, update: {}, create: { ...buyer, passwordHash: buyerHash } }),
    ),
  );

  if ((await prisma.bike.count()) > 0) {
    process.stdout.write('Seed: users ensured; demo data already present, skipping.\n');
    return;
  }

  const bikes = await Promise.all(BIKES.map((bike) => prisma.bike.create({ data: { ...bike, createdById: admin.id } })));
  // The last bike is intentionally left without an auction so the admin can create one.
  const [classic, duke, r15, cb350, ninja, dominar] = bikes as [(typeof bikes)[number], ...typeof bikes];

  const base = { createdById: admin.id, minimumIncrement: 1000 };

  // Live, with an active bidding war, ending soon.
  const live1 = await prisma.auction.create({
    data: { ...base, bikeId: classic.id, status: 'LIVE', startingPrice: 120000, reservePrice: 150000, startsAt: minutes(-60), endsAt: minutes(25), startedAt: minutes(-60) },
  });
  let price = 120000;
  for (const [i, bidder] of [aarav, diya, aarav, diya, aarav].entries()) {
    price = i === 0 ? price : price + 2000;
    await prisma.bid.create({ data: { auctionId: live1.id, bidderId: bidder!.id, amount: price, createdAt: minutes(-50 + i * 8) } });
  }
  await prisma.auction.update({ where: { id: live1.id }, data: { currentPrice: price, highestBidderId: aarav!.id, bidCount: 5 } });

  // Live, no bids yet.
  await prisma.auction.create({
    data: { ...base, bikeId: duke!.id, status: 'LIVE', startingPrice: 180000, minimumIncrement: 2500, startsAt: minutes(-30), endsAt: minutes(180), startedAt: minutes(-30) },
  });

  // Upcoming.
  await prisma.auction.create({
    data: { ...base, bikeId: r15!.id, status: 'SCHEDULED', startingPrice: 140000, reservePrice: 160000, startsAt: minutes(90), endsAt: minutes(90 + 24 * 60) },
  });
  await prisma.auction.create({
    data: { ...base, bikeId: ninja!.id, status: 'SCHEDULED', startingPrice: 450000, minimumIncrement: 5000, startsAt: minutes(24 * 60), endsAt: minutes(3 * 24 * 60) },
  });

  // Ended & sold.
  const sold = await prisma.auction.create({
    data: { ...base, bikeId: cb350!.id, status: 'ENDED', outcome: 'SOLD', startingPrice: 150000, startsAt: minutes(-3 * 24 * 60), endsAt: minutes(-24 * 60), startedAt: minutes(-3 * 24 * 60), endedAt: minutes(-24 * 60) },
  });
  await prisma.bid.createMany({
    data: [
      { auctionId: sold.id, bidderId: aarav!.id, amount: 150000, createdAt: minutes(-2 * 24 * 60) },
      { auctionId: sold.id, bidderId: diya!.id, amount: 158000, createdAt: minutes(-30 * 60) },
    ],
  });
  await prisma.auction.update({ where: { id: sold.id }, data: { currentPrice: 158000, highestBidderId: diya!.id, winnerId: diya!.id, bidCount: 2 } });

  // Drafts for the admin to work with.
  await prisma.auction.create({
    data: { ...base, bikeId: dominar!.id, status: 'DRAFT', startingPrice: 110000, startsAt: minutes(2 * 24 * 60), endsAt: minutes(4 * 24 * 60) },
  });

  process.stdout.write(`Seed complete.\n  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}\n  Buyers: aarav@example.com, diya@example.com / ${BUYER_PASSWORD}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seed failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
