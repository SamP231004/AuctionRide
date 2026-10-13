import type { Prisma } from '@prisma/client';
import type { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { logger } from '../utils/logger.js';

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  context?: RequestContext;
}

/**
 * Writes the audit trail. Audit failures are logged but never fail the user's request:
 * the primary action has already committed by the time we record it.
 */
export class AuditService {
  constructor(private readonly repo: AuditLogRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.create({
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ipAddress: entry.context?.ip ?? null,
        userAgent: entry.context?.userAgent?.slice(0, 512) ?? null,
      });
    } catch (error) {
      logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
    }
  }
}
