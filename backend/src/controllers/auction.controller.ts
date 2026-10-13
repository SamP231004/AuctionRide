import type { Request, Response } from 'express';
import { getValidated, requireUser } from '../middlewares/index.js';
import type { AuctionLifecycleService, Trigger } from '../services/auction-lifecycle.service.js';
import type { AuctionService } from '../services/auction.service.js';
import type { BidService } from '../services/bid.service.js';
import { requestContext, viewerOf } from '../utils/request.js';
import { sendCreated, sendNoContent, sendSuccess } from '../utils/response.js';
import {
  auctionIdSchema,
  cancelAuctionSchema,
  createAuctionSchema,
  listAuctionsSchema,
  listBidsSchema,
  placeBidSchema,
  updateAuctionSchema,
} from '../validators/auction.validator.js';
import { splitPage } from '../validators/common.validator.js';

export class AuctionController {
  constructor(
    private readonly auctions: AuctionService,
    private readonly lifecycle: AuctionLifecycleService,
    private readonly bids: BidService,
  ) {}

  list = async (req: Request, res: Response) => {
    const { query } = getValidated(req, listAuctionsSchema);
    const { page, filters } = splitPage(query);
    const result = await this.auctions.list(filters, page, viewerOf(req));
    sendSuccess(res, result.items, { meta: { ...result.meta, serverTime: new Date() } });
  };

  get = async (req: Request, res: Response) => {
    const { params } = getValidated(req, auctionIdSchema);
    sendSuccess(res, await this.auctions.getById(params.id, viewerOf(req)), { meta: { serverTime: new Date() } });
  };

  brands = async (_req: Request, res: Response) => {
    sendSuccess(res, await this.auctions.brands());
  };

  create = async (req: Request, res: Response) => {
    const { body } = getValidated(req, createAuctionSchema);
    sendCreated(res, await this.auctions.create(body, requireUser(req), requestContext(req)));
  };

  update = async (req: Request, res: Response) => {
    const { params, body } = getValidated(req, updateAuctionSchema);
    sendSuccess(res, await this.auctions.update(params.id, body, requireUser(req), requestContext(req)));
  };

  delete = async (req: Request, res: Response) => {
    const { params } = getValidated(req, auctionIdSchema);
    await this.auctions.delete(params.id, requireUser(req), requestContext(req));
    sendNoContent(res);
  };

  publish = this.transition((id, trigger) => this.lifecycle.publish(id, trigger));
  unpublish = this.transition((id, trigger) => this.lifecycle.unpublish(id, trigger));
  start = this.transition((id, trigger) => this.lifecycle.start(id, trigger));
  end = this.transition((id, trigger) => this.lifecycle.end(id, trigger));

  cancel = async (req: Request, res: Response) => {
    const { params, body } = getValidated(req, cancelAuctionSchema);
    await this.lifecycle.cancel(params.id, body.reason, this.adminTrigger(req));
    sendSuccess(res, await this.auctions.getById(params.id, viewerOf(req)));
  };

  watch = async (req: Request, res: Response) => {
    const { params } = getValidated(req, auctionIdSchema);
    await this.auctions.watch(params.id, requireUser(req));
    sendNoContent(res);
  };

  unwatch = async (req: Request, res: Response) => {
    const { params } = getValidated(req, auctionIdSchema);
    await this.auctions.unwatch(params.id, requireUser(req));
    sendNoContent(res);
  };

  placeBid = async (req: Request, res: Response) => {
    const { params, body } = getValidated(req, placeBidSchema);
    sendCreated(res, await this.bids.placeBid(params.id, requireUser(req), body.amount));
  };

  listBids = async (req: Request, res: Response) => {
    const { params, query } = getValidated(req, listBidsSchema);
    const result = await this.bids.listForAuction(params.id, query, viewerOf(req));
    sendSuccess(res, result.items, { meta: result.meta });
  };

  private adminTrigger(req: Request): Trigger {
    return { kind: 'admin', actorId: requireUser(req).id, context: requestContext(req) };
  }

  /** Shared handler for the parameterless admin state transitions; responds with the fresh auction. */
  private transition(action: (id: string, trigger: Trigger) => Promise<void>) {
    return async (req: Request, res: Response) => {
      const { params } = getValidated(req, auctionIdSchema);
      await action(params.id, this.adminTrigger(req));
      sendSuccess(res, await this.auctions.getById(params.id, viewerOf(req)));
    };
  }
}
