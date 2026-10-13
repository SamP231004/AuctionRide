import type { Request, Response } from 'express';
import { getValidated, requireUser } from '../middlewares/index.js';
import type { MeService } from '../services/me.service.js';
import type { NotificationService } from '../services/notification.service.js';
import { sendNoContent, sendSuccess } from '../utils/response.js';
import { splitPage } from '../validators/common.validator.js';
import {
  myAuctionsSchema,
  notificationIdSchema,
  notificationsSchema,
  watchlistSchema,
} from '../validators/me.validator.js';

export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly notifications: NotificationService,
  ) {}

  summary = async (req: Request, res: Response) => {
    sendSuccess(res, await this.me.summary(requireUser(req)));
  };

  auctions = async (req: Request, res: Response) => {
    const { query } = getValidated(req, myAuctionsSchema);
    const { page, filters } = splitPage(query);
    const result = await this.me.myAuctions(requireUser(req), filters.filter, page);
    sendSuccess(res, result.items, { meta: result.meta });
  };

  watchlist = async (req: Request, res: Response) => {
    const { query } = getValidated(req, watchlistSchema);
    const result = await this.me.watching(requireUser(req), query);
    sendSuccess(res, result.items, { meta: result.meta });
  };

  listNotifications = async (req: Request, res: Response) => {
    const { query } = getValidated(req, notificationsSchema);
    const { page, filters } = splitPage(query);
    const result = await this.notifications.list(requireUser(req).id, filters.unreadOnly, page);
    sendSuccess(res, result.items, { meta: { ...result.meta, unreadCount: result.unreadCount } });
  };

  readNotification = async (req: Request, res: Response) => {
    const { params } = getValidated(req, notificationIdSchema);
    await this.notifications.markRead(requireUser(req).id, params.id);
    sendNoContent(res);
  };

  readAllNotifications = async (req: Request, res: Response) => {
    const updated = await this.notifications.markAllRead(requireUser(req).id);
    sendSuccess(res, { updated });
  };
}
