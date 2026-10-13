import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import type { AuctionLifecycleService } from '../services/auction-lifecycle.service.js';
import type { AuctionScheduler } from '../types/ports.js';
import { logger } from '../utils/logger.js';
import { addDays } from '../utils/time.js';

export const AUCTION_QUEUE = 'auction-lifecycle';

type LifecycleJobName = 'start' | 'end' | 'archive';
type MaintenanceJobName = 'reconcile' | 'cleanup-tokens';
type JobName = LifecycleJobName | MaintenanceJobName;

interface JobData {
  auctionId?: string;
}

// BullMQ reserves ':' in custom job ids.
const jobId = (name: LifecycleJobName, auctionId: string) => `${name}-${auctionId}`;

/**
 * BullMQ-backed AuctionScheduler. Job ids are deterministic per (action, auction), so rescheduling
 * replaces the pending job instead of duplicating it. Processors re-validate state, so a stale job
 * is always harmless.
 */
export class BullMqAuctionScheduler implements AuctionScheduler {
  readonly queue: Queue<JobData, void, JobName>;

  constructor(connection: Redis) {
    this.queue = new Queue<JobData, void, JobName>(AUCTION_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
  }

  scheduleStart(auctionId: string, at: Date) {
    return this.schedule('start', auctionId, at);
  }

  scheduleEnd(auctionId: string, at: Date) {
    return this.schedule('end', auctionId, at);
  }

  scheduleArchive(auctionId: string, at: Date) {
    return this.schedule('archive', auctionId, at);
  }

  async cancel(auctionId: string): Promise<void> {
    await Promise.all((['start', 'end', 'archive'] as const).map((name) => this.removeJob(jobId(name, auctionId))));
  }

  /** Repeatable maintenance jobs (BullMQ job schedulers — upserted, so safe on every boot). */
  async registerMaintenanceJobs(): Promise<void> {
    await this.queue.upsertJobScheduler('reconcile', { every: 60_000 }, { name: 'reconcile' });
    await this.queue.upsertJobScheduler('cleanup-tokens', { pattern: '0 3 * * *', tz: 'UTC' }, { name: 'cleanup-tokens' });
  }

  close(): Promise<void> {
    return this.queue.close();
  }

  private async schedule(name: LifecycleJobName, auctionId: string, at: Date): Promise<void> {
    const baseId = jobId(name, auctionId);
    const removed = await this.removeJob(baseId);
    // When the job is rescheduling itself (e.g. an `end` job that found a soft-close extension) it is
    // still active and cannot be replaced, so the follow-up gets a time-suffixed id instead.
    const id = removed ? baseId : `${baseId}-${at.getTime()}`;
    await this.queue.add(name, { auctionId }, { jobId: id, delay: Math.max(0, at.getTime() - Date.now()) });
    logger.debug({ job: name, auctionId, at }, 'Lifecycle job scheduled');
  }

  /** Returns false only when a job with this id exists and is currently running. */
  private async removeJob(id: string): Promise<boolean> {
    const job = await this.queue.getJob(id);
    if (!job) return true;
    if (await job.isActive()) return false;
    await job.remove();
    return true;
  }
}

export function createAuctionWorker(
  connection: Redis,
  deps: { lifecycle: AuctionLifecycleService; refreshTokens: RefreshTokenRepository },
  concurrency: number,
): Worker<JobData, void, JobName> {
  const worker = new Worker<JobData, void, JobName>(
    AUCTION_QUEUE,
    async (job: Job<JobData, void, JobName>) => {
      const { auctionId } = job.data;
      switch (job.name) {
        case 'start':
          if (auctionId) await deps.lifecycle.start(auctionId);
          return;
        case 'end':
          if (auctionId) await deps.lifecycle.end(auctionId);
          return;
        case 'archive':
          if (auctionId) await deps.lifecycle.archive(auctionId);
          return;
        case 'reconcile':
          await deps.lifecycle.reconcile();
          return;
        case 'cleanup-tokens': {
          const removed = await deps.refreshTokens.deleteStale(addDays(new Date(), -1));
          logger.info({ removed }, 'Stale refresh tokens removed');
          return;
        }
      }
    },
    { connection, concurrency },
  );

  worker.on('failed', (job, error) =>
    logger.error({ err: error, job: job?.name, jobId: job?.id, attempts: job?.attemptsMade }, 'Job failed'),
  );
  worker.on('error', (error) => logger.error({ err: error }, 'Worker error'));
  return worker;
}
