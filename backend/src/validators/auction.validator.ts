import { z } from 'zod';
import { idParams, isoDate, paginationQuery, rupees, text, uuid } from './common.validator.js';

const status = z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED', 'CANCELLED']);
const sort = z.enum(['ending_soon', 'starting_soon', 'newest', 'price_asc', 'price_desc', 'most_bids']);

export const listAuctionsSchema = {
  query: paginationQuery
    .extend({
      status: status.optional(),
      q: text(1, 100).optional(),
      brand: text(1, 60).optional(),
      minPrice: rupees.optional(),
      maxPrice: rupees.optional(),
      minYear: z.coerce.number().int().min(1900).max(2100).optional(),
      maxYear: z.coerce.number().int().min(1900).max(2100).optional(),
      sort: sort.default('ending_soon'),
    })
    .strict(),
};

export const auctionIdSchema = { params: idParams };

const auctionFields = {
  startingPrice: rupees,
  reservePrice: rupees.nullable().optional(),
  minimumIncrement: rupees,
  startsAt: isoDate,
  endsAt: isoDate,
};

export const createAuctionSchema = {
  body: z
    .object({ bikeId: uuid, ...auctionFields })
    .strict()
    .refine((value) => value.endsAt > value.startsAt, { message: 'End time must be after start time', path: ['endsAt'] }),
};

export const updateAuctionSchema = {
  params: idParams,
  body: z
    .object({
      startingPrice: auctionFields.startingPrice.optional(),
      reservePrice: auctionFields.reservePrice,
      minimumIncrement: auctionFields.minimumIncrement.optional(),
      startsAt: auctionFields.startsAt.optional(),
      endsAt: auctionFields.endsAt.optional(),
      version: z.number().int().min(0),
    })
    .strict(),
};

export const cancelAuctionSchema = {
  params: idParams,
  body: z.object({ reason: text(3, 500) }).strict(),
};

export const placeBidSchema = {
  params: idParams,
  body: z.object({ amount: rupees }).strict(),
};

export const listBidsSchema = {
  params: idParams,
  query: paginationQuery.strict(),
};
