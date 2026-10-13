import type { NotificationType } from '@prisma/client';
import type { NotificationRepository } from '../repositories/notification.repository.js';
import type { RealtimePublisher } from '../types/ports.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { paginate, type PageParams } from '../utils/pagination.js';
import type { Clock } from '../utils/time.js';
import { toNotificationDto } from './mappers.js';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  auctionId?: string;
}

export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly realtime: RealtimePublisher,
    private readonly clock: Clock,
  ) {}

  /**
   * Persists and pushes a notification to each user. Called after the triggering transaction
   * commits; failures are logged rather than surfaced since the core action already succeeded.
   */
  async notifyMany(userIds: string[], input: NotificationInput): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    try {
      const created = await this.repo.createMany(unique.map((userId) => ({ userId, ...input })));
      for (const notification of created) {
        this.realtime.notify(notification.userId, toNotificationDto(notification));
      }
    } catch (error) {
      logger.error({ err: error, type: input.type }, 'Failed to create notifications');
    }
  }

  async list(userId: string, unreadOnly: boolean, page: PageParams) {
    const [items, total] = await this.repo.list(userId, unreadOnly, page);
    const unreadCount = await this.repo.countUnread(userId);
    return { ...paginate(items.map(toNotificationDto), total, page), unreadCount };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const found = await this.repo.markRead(userId, id, this.clock.now());
    if (!found) throw new NotFoundError('Notification');
  }

  markAllRead(userId: string): Promise<number> {
    return this.repo.markAllRead(userId, this.clock.now());
  }
}
