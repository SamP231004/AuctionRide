import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

type CheckStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: { status: CheckStatus; latencyMs?: number };
    redis: { status: CheckStatus; latencyMs?: number };
  };
}

async function timed(check: () => Promise<unknown>, timeoutMs = 2_000): Promise<{ status: CheckStatus; latencyMs?: number }> {
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: 'down' };
  } finally {
    clearTimeout(timer);
  }
}

export class HealthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly redis: Redis | undefined,
    private readonly version: string,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      timed(() => this.db.$queryRaw`SELECT 1`),
      this.redis ? timed(() => this.redis!.ping()) : Promise.resolve({ status: 'up' as const }),
    ]);
    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }
}
