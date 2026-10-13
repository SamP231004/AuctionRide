/** Central query-key factory: one place to reason about cache invalidation. */
export const queryKeys = {
  auctions: {
    all: ['auctions'] as const,
    lists: () => ['auctions', 'list'] as const,
    list: (params: Record<string, unknown>) => ['auctions', 'list', params] as const,
    detail: (id: string) => ['auctions', 'detail', id] as const,
    bids: (id: string) => ['auctions', 'bids', id] as const,
    brands: () => ['auctions', 'brands'] as const,
  },
  me: {
    all: ['me'] as const,
    summary: () => ['me', 'summary'] as const,
    auctions: (filter: string, page: number) => ['me', 'auctions', filter, page] as const,
    watchlist: (page: number) => ['me', 'watchlist', page] as const,
    notifications: () => ['me', 'notifications'] as const,
  },
  admin: {
    all: ['admin'] as const,
    dashboard: () => ['admin', 'dashboard'] as const,
    analytics: (days: number) => ['admin', 'analytics', days] as const,
    winners: (page: number) => ['admin', 'winners', page] as const,
    bikes: (params: Record<string, unknown>) => ['admin', 'bikes', params] as const,
    bike: (id: string) => ['admin', 'bike', id] as const,
  },
};
