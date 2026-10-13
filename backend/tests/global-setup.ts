import { execSync } from 'node:child_process';

/** Applies migrations to the test database once per run (creates the database if needed). */
export default function setup(): void {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://auctionride:auctionride@localhost:5433/auctionride_test?schema=public';
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
