import type { BikeListFilters, BikeRepository } from '../repositories/bike.repository.js';
import { UPLOADS } from '../config/constants.js';
import type { StorageProvider } from '../types/ports.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { paginate, type PageParams } from '../utils/pagination.js';
import type { AuditService, RequestContext } from './audit.service.js';
import { toBikeDto, toImageDto, type Viewer } from './mappers.js';
import { detectImageType } from './storage.service.js';

export interface BikeInput {
  title: string;
  brand: string;
  model: string;
  year: number;
  engineCC: number;
  kilometers: number;
  owners: number;
  location: string;
  description: string;
}

export class BikeService {
  constructor(
    private readonly bikes: BikeRepository,
    private readonly storage: StorageProvider,
    private readonly audit: AuditService,
  ) {}

  async list(filters: BikeListFilters, page: PageParams) {
    const [items, total] = await this.bikes.list(filters, page);
    return paginate(
      items.map((bike) => ({
        ...toBikeDto(bike),
        auctionCount: bike._count.auctions,
        activeAuction: bike.auctions[0] ?? null,
      })),
      total,
      page,
    );
  }

  async getById(id: string) {
    const bike = await this.bikes.findDetail(id);
    if (!bike) throw new NotFoundError('Bike');
    return { ...toBikeDto(bike), auctions: bike.auctions };
  }

  async create(input: BikeInput, actor: Viewer, ctx: RequestContext) {
    const bike = await this.bikes.create({ ...input, createdById: actor.id });
    await this.audit.record({ actorId: actor.id, action: 'bike.create', entityType: 'bike', entityId: bike.id, context: ctx });
    return toBikeDto(bike);
  }

  async update(id: string, input: Partial<BikeInput>, actor: Viewer, ctx: RequestContext) {
    if (!(await this.bikes.findById(id))) throw new NotFoundError('Bike');
    const bike = await this.bikes.update(id, input);
    await this.audit.record({ actorId: actor.id, action: 'bike.update', entityType: 'bike', entityId: id, context: ctx });
    return toBikeDto(bike);
  }

  async delete(id: string, actor: Viewer, ctx: RequestContext): Promise<void> {
    const bike = await this.bikes.findById(id);
    if (!bike) throw new NotFoundError('Bike');
    if (await this.bikes.hasAuctionWithBids(id)) {
      throw new ConflictError('Bikes with bid history cannot be deleted', 'BIKE_HAS_BIDS');
    }
    if (await this.bikes.hasActiveAuction(id)) {
      throw new ConflictError('Cancel or delete the active auction first', 'BIKE_HAS_ACTIVE_AUCTION');
    }
    await this.bikes.delete(id);
    await Promise.all(bike.images.map((image) => this.storage.delete(image.storageKey)));
    await this.audit.record({ actorId: actor.id, action: 'bike.delete', entityType: 'bike', entityId: id, context: ctx });
  }

  async addImages(bikeId: string, files: { buffer: Buffer }[], actor: Viewer, ctx: RequestContext) {
    if (files.length === 0) throw new ValidationError('Attach at least one image', undefined, 'NO_FILES');
    if (!(await this.bikes.findById(bikeId))) throw new NotFoundError('Bike');

    const existing = await this.bikes.countImages(bikeId);
    if (existing + files.length > UPLOADS.MAX_IMAGES_PER_BIKE) {
      throw new ValidationError(`A bike can have at most ${UPLOADS.MAX_IMAGES_PER_BIKE} images`, undefined, 'TOO_MANY_IMAGES');
    }

    const typed = files.map((file) => ({ buffer: file.buffer, extension: detectImageType(file.buffer) }));
    if (typed.some((file) => file.extension === null)) {
      throw new ValidationError('Only JPEG, PNG and WebP images are allowed', undefined, 'UNSUPPORTED_FILE_TYPE');
    }

    const stored = await Promise.all(typed.map((file) => this.storage.save({ buffer: file.buffer, extension: file.extension! })));
    try {
      const images = await this.bikes.addImages(
        bikeId,
        stored.map((file) => ({ url: file.url, storageKey: file.key })),
      );
      await this.audit.record({ actorId: actor.id, action: 'bike.images.add', entityType: 'bike', entityId: bikeId, metadata: { count: images.length }, context: ctx });
      return images.map(toImageDto);
    } catch (error) {
      // Do not leave orphaned files when the database write fails.
      await Promise.all(stored.map((file) => this.storage.delete(file.key)));
      throw error;
    }
  }

  async deleteImage(bikeId: string, imageId: string, actor: Viewer, ctx: RequestContext): Promise<void> {
    const image = await this.bikes.findImage(bikeId, imageId);
    if (!image) throw new NotFoundError('Image');
    await this.bikes.deleteImage(imageId);
    await this.storage.delete(image.storageKey).catch((error: unknown) => {
      logger.warn({ err: error, key: image.storageKey }, 'Failed to delete image file');
    });
    await this.audit.record({ actorId: actor.id, action: 'bike.images.delete', entityType: 'bike', entityId: bikeId, context: ctx });
  }
}
