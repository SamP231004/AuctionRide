export interface PageParams {
  page: number;
  limit: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export function toSkipTake({ page, limit }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

export function buildPageMeta({ page, limit }: PageParams, total: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNextPage: page < totalPages };
}

export function paginate<T>(items: T[], total: number, params: PageParams): Paginated<T> {
  return { items, meta: buildPageMeta(params, total) };
}
