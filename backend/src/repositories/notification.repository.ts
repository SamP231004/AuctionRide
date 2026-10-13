import type { Notification, NotificationType, PrismaClient } from '@prisma/client';
import type { PageParams } from '../utils/pagination.js';
import { toSkipTake } from '../utils/pagination.js';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  auctionId?: string | null;
}

export class NotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  createMany(items: NewNotification[]): Promise<Notification[]> {
    if (items.length === 0) return Promise.resolve([]);
    return this.db.notification.createManyAndReturn({ data: items });
  }

  async list(userId: string, unreadOnly: boolean, page: PageParams): Promise<[Notification[], number]> {
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    return this.db.$transaction([
      this.db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(page) }),
      this.db.notification.count({ where }),
    ]);
  }

  countUnread(userId: string): Promise<number> {
    return this.db.notification.count({ where: { userId, readAt: null } });
  }

  /**
   * Scoped by userId so a user can never mark someone else's notification.
   * Returns false when the notification does not exist for this user.
   */
  async markRead(userId: string, id: string, at: Date): Promise<boolean> {
    const result = await this.db.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: at },
    });
    if (result.count === 1) return true;
    // Distinguish "already read" (fine) from "not yours / does not exist".
    const exists = await this.db.notification.count({ where: { id, userId } });
    return exists === 1;
  }

  async markAllRead(userId: string, at: Date): Promise<number> {
    const result = await this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: at },
    });
    return result.count;
  }
}
