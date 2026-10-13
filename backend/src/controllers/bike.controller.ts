import type { Request, Response } from 'express';
import { getValidated, requireUser } from '../middlewares/index.js';
import type { BikeService } from '../services/bike.service.js';
import { requestContext } from '../utils/request.js';
import { sendCreated, sendNoContent, sendSuccess } from '../utils/response.js';
import {
  bikeIdSchema,
  bikeImageSchema,
  createBikeSchema,
  listBikesSchema,
  updateBikeSchema,
} from '../validators/bike.validator.js';
import { splitPage } from '../validators/common.validator.js';

export class BikeController {
  constructor(private readonly bikes: BikeService) {}

  list = async (req: Request, res: Response) => {
    const { query } = getValidated(req, listBikesSchema);
    const { page, filters } = splitPage(query);
    const result = await this.bikes.list(filters, page);
    sendSuccess(res, result.items, { meta: result.meta });
  };

  get = async (req: Request, res: Response) => {
    const { params } = getValidated(req, bikeIdSchema);
    sendSuccess(res, await this.bikes.getById(params.id));
  };

  create = async (req: Request, res: Response) => {
    const { body } = getValidated(req, createBikeSchema);
    sendCreated(res, await this.bikes.create(body, requireUser(req), requestContext(req)));
  };

  update = async (req: Request, res: Response) => {
    const { params, body } = getValidated(req, updateBikeSchema);
    sendSuccess(res, await this.bikes.update(params.id, body, requireUser(req), requestContext(req)));
  };

  delete = async (req: Request, res: Response) => {
    const { params } = getValidated(req, bikeIdSchema);
    await this.bikes.delete(params.id, requireUser(req), requestContext(req));
    sendNoContent(res);
  };

  uploadImages = async (req: Request, res: Response) => {
    const { params } = getValidated(req, bikeIdSchema);
    const files = Array.isArray(req.files) ? req.files : [];
    sendCreated(res, await this.bikes.addImages(params.id, files, requireUser(req), requestContext(req)));
  };

  deleteImage = async (req: Request, res: Response) => {
    const { params } = getValidated(req, bikeImageSchema);
    await this.bikes.deleteImage(params.id, params.imageId, requireUser(req), requestContext(req));
    sendNoContent(res);
  };
}
