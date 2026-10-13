import { z } from 'zod';
import { idParams, paginationQuery, text, uuid } from './common.validator.js';

const currentYear = new Date().getUTCFullYear();

const bikeFields = {
  title: text(3, 120),
  brand: text(2, 60),
  model: text(1, 80),
  year: z.coerce.number().int().min(1950).max(currentYear + 1),
  engineCC: z.coerce.number().int().min(50).max(3000),
  kilometers: z.coerce.number().int().min(0).max(1_000_000),
  owners: z.coerce.number().int().min(1).max(10).default(1),
  location: text(2, 80),
  description: text(10, 5000),
};

export const listBikesSchema = {
  query: paginationQuery.extend({ q: text(1, 100).optional(), brand: text(1, 60).optional() }).strict(),
};

export const bikeIdSchema = { params: idParams };

export const createBikeSchema = { body: z.object(bikeFields).strict() };

export const updateBikeSchema = {
  params: idParams,
  body: z.object(bikeFields).partial().strict(),
};

export const bikeImageSchema = {
  params: z.object({ id: uuid, imageId: uuid }).strict(),
};
