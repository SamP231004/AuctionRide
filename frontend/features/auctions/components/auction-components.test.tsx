import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatINR } from '@/lib/utils';
import type * as ApiClientModule from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import type { AuctionDetail, AuctionSummary, User } from '@/types/api';
import { AuctionCard } from './auction-card';
import { BidPanel } from './bid-panel';

vi.mock('next/navigation', () => ({ usePathname: () => '/auctions/a1', useRouter: () => ({ push: vi.fn() }) }));

const placeBid = vi.fn();
vi.mock('@/services/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  api: { post: (...args: unknown[]) => placeBid(...args) },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const buyer: User = { id: 'u1', name: 'Asha Rao', email: 'asha@example.com', role: 'BUYER', createdAt: '2026-01-01T00:00:00Z' };
const inOneHour = new Date(Date.now() + 3_600_000).toISOString();

const summary: AuctionSummary = {
  id: 'a1',
  status: 'LIVE',
  outcome: null,
  startingPrice: 100_000,
  currentPrice: 125_000,
  minimumIncrement: 1_000,
  minimumNextBid: 126_000,
  bidCount: 4,
  hasReserve: false,
  reserveMet: null,
  startsAt: new Date().toISOString(),
  endsAt: inOneHour,
  extensionCount: 0,
  winnerId: null,
  highestBidder: { id: 'u1', name: 'A***a R.' },
  bike: {
    id: 'b1',
    title: 'KTM 390 Duke',
    brand: 'KTM',
    model: '390 Duke',
    year: 2021,
    engineCC: 373,
    kilometers: 15_200,
    owners: 1,
    location: 'Pune',
    coverImageUrl: null,
  },
};

const detail = {
  ...summary,
  highestBidder: { id: 'someone-else', name: 'R***l S.' },
  startedAt: null,
  endedAt: null,
  cancelReason: null,
  version: 1,
  watcherCount: 0,
  isWatching: false,
  winner: null,
  createdAt: summary.startsAt,
  bike: { ...summary.bike, description: '', images: [], createdAt: summary.startsAt },
} as AuctionDetail;

describe('AuctionCard', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', user: buyer, accessToken: 't' }));

  it('shows the bike, the live badge and the current bid in INR', () => {
    render(<AuctionCard auction={summary} />, { wrapper });
    expect(screen.getByRole('heading', { name: 'KTM 390 Duke' })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText(formatINR(125_000))).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/auctions/a1');
  });

  it('tells the viewer when they are leading', () => {
    render(<AuctionCard auction={summary} />, { wrapper });
    expect(screen.getByText('You lead')).toBeInTheDocument();
  });
});

describe('BidPanel', () => {
  beforeEach(() => placeBid.mockReset());

  it('asks anonymous visitors to sign in', () => {
    useAuthStore.setState({ status: 'unauthenticated', user: null, accessToken: null });
    render(<BidPanel auction={detail} />, { wrapper });
    expect(screen.getByRole('link', { name: /sign in to bid/i })).toHaveAttribute('href', '/login?next=%2Fauctions%2Fa1');
  });

  it('blocks bids below the minimum next bid without calling the API', async () => {
    useAuthStore.setState({ status: 'authenticated', user: buyer, accessToken: 't' });
    render(<BidPanel auction={detail} />, { wrapper });

    const input = screen.getByLabelText(/bid amount/i);
    await userEvent.clear(input);
    await userEvent.type(input, '125500');
    await userEvent.click(screen.getByRole('button', { name: /place bid/i }));

    expect(await screen.findByText(/minimum bid is/i)).toBeInTheDocument();
    expect(placeBid).not.toHaveBeenCalled();
  });

  it('submits a valid bid', async () => {
    useAuthStore.setState({ status: 'authenticated', user: buyer, accessToken: 't' });
    placeBid.mockResolvedValue({
      data: {
        bid: { id: 'b9', auctionId: 'a1', amount: 126_000, createdAt: new Date().toISOString(), bidder: { id: 'u1', name: 'Asha Rao' } },
        auction: { auctionId: 'a1', status: 'LIVE', currentPrice: 126_000, minimumNextBid: 127_000, bidCount: 5, highestBidder: { id: 'u1', name: 'A***a R.' }, endsAt: inOneHour, outcome: null, winnerId: null },
      },
    });
    render(<BidPanel auction={detail} />, { wrapper });

    await userEvent.click(screen.getByRole('button', { name: /place bid/i }));
    await waitFor(() => expect(placeBid).toHaveBeenCalledWith('/auctions/a1/bids', { amount: 126_000 }));
  });

  it('renders nothing for auctions that are not live', () => {
    useAuthStore.setState({ status: 'authenticated', user: buyer, accessToken: 't' });
    const { container } = render(<BidPanel auction={{ ...detail, status: 'ENDED' }} />, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });
});
