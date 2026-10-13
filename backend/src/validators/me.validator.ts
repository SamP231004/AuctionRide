import { z } from 'zod';
import { idParams, paginationQuery } from './common.validator.js';

export const myAuctionsSchema = {
  query: paginationQuery.extend({ filter: z.enum(['active', 'won', 'lost', 'all']).default('all') }).strict(),
};

export const watchlistSchema = { query: paginationQuery.strict() };

export const notificationsSchema = {
  query: paginationQuery
    .extend({ unreadOnly: z.enum(['true', 'false']).default('false').transform((v) => v === 'true') })
    .strict(),
};

export const notificationIdSchema = { params: idParams };

export const analyticsSchema = {
  query: z.object({ days: z.coerce.number().int().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).default(30) }).strict(),
};

export const winnersSchema = { query: paginationQuery.strict() };
