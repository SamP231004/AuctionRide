import { z } from 'zod';
import { PAGINATION } from '../config/constants.js';

export const uuid = z.string().uuid({ message: 'Must be a valid id' });

export const idParams = z.object({ id: uuid }).strict();

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

/** Trimmed text with a length cap. Rejects strings that are only whitespace. */
export const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Whole rupees. */
export const rupees = z.coerce.number().int('Must be a whole number of rupees').positive().max(100_000_000);

export const isoDate = z.coerce.date({ invalid_type_error: 'Must be a valid date' });

/** Splits page/limit from the remaining filters. */
export function splitPage<T extends { page: number; limit: number }>(query: T) {
  const { page, limit, ...rest } = query;
  return { page: { page, limit }, filters: rest };
}
