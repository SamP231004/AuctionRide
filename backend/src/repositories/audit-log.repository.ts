import type { AuditLog, Prisma, PrismaClient } from '@prisma/client';
import type { PageParams } from '../utils/pagination.js';
import { toSkipTake } from '../utils/pagination.js';

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
}

export type AuditLogWithActor = AuditLog & { actor: { id: string; name: string; email: string } | null };

export class AuditLogRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
    return this.db.auditLog.create({ data });
  }

  async list(filters: AuditLogFilters, page: PageParams): Promise<[AuditLogWithActor[], number]> {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
    };
    return this.db.$transaction([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
        ...toSkipTake(page),
      }),
      this.db.auditLog.count({ where }),
    ]);
  }
}
