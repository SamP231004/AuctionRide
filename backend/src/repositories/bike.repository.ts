import type { Bike, BikeImage, Prisma, PrismaClient } from '@prisma/client';
import type { PageParams } from '../utils/pagination.js';
import { toSkipTake } from '../utils/pagination.js';
import type { DbClient } from './types.js';

const ACTIVE_AUCTION_STATUSES = ['DRAFT', 'SCHEDULED', 'LIVE'] as const;

export const bikeWithImages = {
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.BikeInclude;

export const bikeListInclude = {
  images: { orderBy: { position: 'asc' }, take: 1 },
  _count: { select: { auctions: true } },
  auctions: {
    where: { status: { in: [...ACTIVE_AUCTION_STATUSES] } },
    select: { id: true, status: true },
    take: 1,
  },
} satisfies Prisma.BikeInclude;

export type BikeWithImages = Prisma.BikeGetPayload<{ include: typeof bikeWithImages }>;
export type BikeListItem = Prisma.BikeGetPayload<{ include: typeof bikeListInclude }>;
export type BikeDetail = Prisma.BikeGetPayload<{
  include: typeof bikeWithImages & {
    auctions: {
      select: { id: true; status: true; startsAt: true; endsAt: true; currentPrice: true; bidCount: true; outcome: true };
    };
  };
}>;

export interface BikeListFilters {
  q?: string;
  brand?: string;
}

export class BikeRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(filters: BikeListFilters, page: PageParams): Promise<[BikeListItem[], number]> {
    const where: Prisma.BikeWhereInput = {
      ...(filters.brand ? { brand: { equals: filters.brand, mode: 'insensitive' } } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: 'insensitive' } },
              { brand: { contains: filters.q, mode: 'insensitive' } },
              { model: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.db.$transaction([
      this.db.bike.findMany({ where, include: bikeListInclude, orderBy: { createdAt: 'desc' }, ...toSkipTake(page) }),
      this.db.bike.count({ where }),
    ]);
  }

  findById(id: string, tx: DbClient = this.db): Promise<BikeWithImages | null> {
    return tx.bike.findUnique({ where: { id }, include: bikeWithImages });
  }

  findDetail(id: string): Promise<BikeDetail | null> {
    return this.db.bike.findUnique({
      where: { id },
      include: {
        ...bikeWithImages,
        auctions: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, startsAt: true, endsAt: true, currentPrice: true, bidCount: true, outcome: true },
        },
      },
    });
  }

  create(data: Prisma.BikeUncheckedCreateInput): Promise<BikeWithImages> {
    return this.db.bike.create({ data, include: bikeWithImages });
  }

  update(id: string, data: Prisma.BikeUpdateInput): Promise<BikeWithImages> {
    return this.db.bike.update({ where: { id }, data, include: bikeWithImages });
  }

  delete(id: string, tx: DbClient = this.db): Promise<Bike> {
    return tx.bike.delete({ where: { id } });
  }

  /** True when any auction for this bike has received bids — such bikes are part of the audit trail. */
  async hasAuctionWithBids(id: string): Promise<boolean> {
    const count = await this.db.auction.count({ where: { bikeId: id, bidCount: { gt: 0 } } });
    return count > 0;
  }

  async hasActiveAuction(bikeId: string, excludeAuctionId?: string, tx: DbClient = this.db): Promise<boolean> {
    const count = await tx.auction.count({
      where: {
        bikeId,
        status: { in: [...ACTIVE_AUCTION_STATUSES] },
        ...(excludeAuctionId ? { id: { not: excludeAuctionId } } : {}),
      },
    });
    return count > 0;
  }

  countImages(bikeId: string): Promise<number> {
    return this.db.bikeImage.count({ where: { bikeId } });
  }

  async addImages(bikeId: string, images: { url: string; storageKey: string }[]): Promise<BikeImage[]> {
    return this.db.$transaction(async (tx) => {
      const last = await tx.bikeImage.findFirst({
        where: { bikeId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const start = (last?.position ?? -1) + 1;
      return tx.bikeImage.createManyAndReturn({
        data: images.map((image, index) => ({ bikeId, ...image, position: start + index })),
      });
    });
  }

  findImage(bikeId: string, imageId: string): Promise<BikeImage | null> {
    return this.db.bikeImage.findFirst({ where: { id: imageId, bikeId } });
  }

  deleteImage(imageId: string): Promise<BikeImage> {
    return this.db.bikeImage.delete({ where: { id: imageId } });
  }

  async distinctBrands(): Promise<string[]> {
    const rows = await this.db.bike.findMany({ distinct: ['brand'], select: { brand: true }, orderBy: { brand: 'asc' } });
    return rows.map((row) => row.brand);
  }
}
