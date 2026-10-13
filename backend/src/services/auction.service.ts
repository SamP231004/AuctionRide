import type { AuctionStatus } from '@prisma/client';
import type { AuctionListFilters, AuctionRepository } from '../repositories/auction.repository.js';
import type { BikeRepository } from '../repositories/bike.repository.js';
import type { WatchlistRepository } from '../repositories/watchlist.repository.js';
import type { AuctionScheduler } from '../types/ports.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../utils/errors.js';
import { paginate, type PageParams } from '../utils/pagination.js';
import type { Clock } from '../utils/time.js';
import { PUBLIC_STATUSES } from './auction-rules.js';
import type { AuditService, RequestContext } from './audit.service.js';
import { toAuctionDetailDto, toAuctionSummaryDto, type Viewer } from './mappers.js';

export interface AuctionInput {
  bikeId: string;
  startingPrice: number;
  reservePrice?: number | null;
  minimumIncrement: number;
  startsAt: Date;
  endsAt: Date;
}

export type AuctionListQuery = Omit<AuctionListFilters, 'statuses'> & { status?: AuctionStatus };

const EDITABLE_STATUSES: AuctionStatus[] = ['DRAFT', 'SCHEDULED'];
const ALL_STATUSES: AuctionStatus[] = ['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED', 'CANCELLED'];
const MIN_DURATION_MS = 5 * 60_000;
const MAX_DURATION_MS = 30 * 24 * 3_600_000;

function assertPricingAndSchedule(input: Omit<AuctionInput, 'bikeId'>): void {
  if (input.endsAt.getTime() - input.startsAt.getTime() < MIN_DURATION_MS) {
    throw new BusinessRuleError('INVALID_SCHEDULE', 'Auctions must run for at least 5 minutes');
  }
  if (input.endsAt.getTime() - input.startsAt.getTime() > MAX_DURATION_MS) {
    throw new BusinessRuleError('INVALID_SCHEDULE', 'Auctions can run for at most 30 days');
  }
  if (input.reservePrice !== null && input.reservePrice !== undefined && input.reservePrice < input.startingPrice) {
    throw new BusinessRuleError('INVALID_RESERVE', 'Reserve price cannot be below the starting price');
  }
}

export class AuctionService {
  constructor(
    private readonly auctions: AuctionRepository,
    private readonly bikes: BikeRepository,
    private readonly watchlist: WatchlistRepository,
    private readonly scheduler: AuctionScheduler,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(query: AuctionListQuery, page: PageParams, viewer?: Viewer) {
    const { status, ...filters } = query;
    const [items, total] = await this.auctions.list(
      { ...filters, statuses: this.visibleStatuses(status, viewer) },
      page,
    );
    return paginate(
      items.map((item) => toAuctionSummaryDto(item, viewer)),
      total,
      page,
    );
  }

  async getById(id: string, viewer?: Viewer) {
    const record = await this.auctions.findDetail(id);
    if (!record || (record.status === 'DRAFT' && viewer?.role !== 'ADMIN')) throw new NotFoundError('Auction');
    const isWatching = viewer ? await this.watchlist.isWatching(viewer.id, id) : false;
    return toAuctionDetailDto(record, viewer, isWatching);
  }

  brands(): Promise<string[]> {
    return this.auctions.distinctBrands(PUBLIC_STATUSES);
  }

  async create(input: AuctionInput, actor: Viewer, ctx: RequestContext) {
    assertPricingAndSchedule(input);
    const bike = await this.bikes.findById(input.bikeId);
    if (!bike) throw new NotFoundError('Bike');
    if (await this.bikes.hasActiveAuction(input.bikeId)) {
      throw new ConflictError('This bike already has an active auction', 'BIKE_HAS_ACTIVE_AUCTION');
    }

    const record = await this.auctions.create({
      ...input,
      reservePrice: input.reservePrice ?? null,
      status: 'DRAFT',
      createdById: actor.id,
    });
    await this.audit.record({ actorId: actor.id, action: 'auction.create', entityType: 'auction', entityId: record.id, context: ctx });
    return toAuctionDetailDto(record, actor, false);
  }

  /** Edits are allowed only before the auction goes live, guarded by an optimistic version check. */
  async update(id: string, input: Partial<Omit<AuctionInput, 'bikeId'>> & { version: number }, actor: Viewer, ctx: RequestContext) {
    const current = await this.auctions.findById(id);
    if (!current) throw new NotFoundError('Auction');
    if (!EDITABLE_STATUSES.includes(current.status)) {
      throw new ConflictError('Only draft or scheduled auctions can be edited', 'AUCTION_NOT_EDITABLE');
    }

    const { version, ...changes } = input;
    const merged = { ...current, ...changes, reservePrice: changes.reservePrice === undefined ? current.reservePrice : changes.reservePrice };
    assertPricingAndSchedule(merged);
    if (current.status === 'SCHEDULED' && merged.endsAt.getTime() <= this.clock.now().getTime() + 60_000) {
      throw new BusinessRuleError('INVALID_SCHEDULE', 'End time must be at least one minute in the future');
    }

    const updated = await this.auctions.updateIfVersion(id, version, changes);
    if (!updated) {
      throw new ConflictError('This auction was modified by someone else. Reload and try again.', 'STALE_VERSION');
    }
    if (current.status === 'SCHEDULED' && changes.startsAt) {
      await this.scheduler.scheduleStart(id, changes.startsAt);
    }
    await this.audit.record({
      actorId: actor.id,
      action: 'auction.update',
      entityType: 'auction',
      entityId: id,
      metadata: JSON.parse(JSON.stringify(changes)) as Record<string, string>,
      context: ctx,
    });
    return this.getById(id, actor);
  }

  async delete(id: string, actor: Viewer, ctx: RequestContext): Promise<void> {
    const current = await this.auctions.findById(id);
    if (!current) throw new NotFoundError('Auction');
    if (current.status !== 'DRAFT') {
      throw new ConflictError('Only draft auctions can be deleted; cancel it instead', 'AUCTION_NOT_DELETABLE');
    }
    await this.auctions.delete(id);
    await this.audit.record({ actorId: actor.id, action: 'auction.delete', entityType: 'auction', entityId: id, context: ctx });
  }

  async watch(id: string, viewer: Viewer): Promise<void> {
    const auction = await this.auctions.findById(id);
    if (!auction || !PUBLIC_STATUSES.includes(auction.status)) throw new NotFoundError('Auction');
    await this.watchlist.add(viewer.id, id);
  }

  unwatch(id: string, viewer: Viewer): Promise<void> {
    return this.watchlist.remove(viewer.id, id);
  }

  /** Buyers can only ever list public statuses, whatever they ask for; admins can list anything. */
  private visibleStatuses(requested: AuctionStatus | undefined, viewer?: Viewer): AuctionStatus[] {
    const isAdmin = viewer?.role === 'ADMIN';
    if (requested) return isAdmin || PUBLIC_STATUSES.includes(requested) ? [requested] : [];
    return isAdmin ? ALL_STATUSES : ['SCHEDULED', 'LIVE', 'ENDED'];
  }
}
