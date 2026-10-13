import type { Prisma, PrismaClient } from '@prisma/client';

/** Either the root client or an interactive-transaction client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface TransactionManager {
  /** Runs `fn` in a single database transaction. */
  run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

export function createTransactionManager(db: PrismaClient): TransactionManager {
  return {
    run: (fn) =>
      db.$transaction(fn, {
        // Bids wait on a row lock; keep the wait bounded so a stuck transaction cannot pile up requests.
        maxWait: 5_000,
        timeout: 10_000,
      }),
  };
}
