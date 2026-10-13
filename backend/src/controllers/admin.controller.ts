import type { Request, Response } from 'express';
import { getValidated, requireUser } from '../middlewares/index.js';
import type { AdminService } from '../services/admin.service.js';
import type { HealthService } from '../services/health.service.js';
import { sendSuccess } from '../utils/response.js';
import { analyticsSchema, winnersSchema } from '../validators/me.validator.js';

export class AdminController {
  constructor(private readonly admin: AdminService) {}

  dashboard = async (req: Request, res: Response) => {
    sendSuccess(res, await this.admin.dashboard(requireUser(req)));
  };

  analytics = async (req: Request, res: Response) => {
    const { query } = getValidated(req, analyticsSchema);
    sendSuccess(res, await this.admin.analyticsReport(query.days));
  };

  winners = async (req: Request, res: Response) => {
    const { query } = getValidated(req, winnersSchema);
    const result = await this.admin.winners(query, requireUser(req));
    sendSuccess(res, result.items, { meta: result.meta });
  };
}

export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Full report; 503 when a dependency is down so load balancers can act on it. */
  report = async (_req: Request, res: Response) => {
    const report = await this.health.check();
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  };

  live = (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  };
}
