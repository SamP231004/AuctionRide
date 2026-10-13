# AuctionRide

Real-time auctions for pre-owned motorcycles. Buyers bid live and every connected client sees the new price,
leader, bid count and remaining time within milliseconds. Auctions start, end, pick a winner and archive themselves.

> Design rationale, diagrams and the scaling plan live in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Features

**Buyers:** register / sign in · browse live, upcoming and past auctions · search (debounced) and filter by brand, sort by
price, end time or activity · live auction room with bid panel, quick-bid buttons, animated bid history and a
server-synced countdown · watchlist with a notification when a watched auction goes live · outbid / won / lost
notifications (toast + bell) · dashboard of active bids, watchlist, wins and losses · profile.

**Admins:** dashboard with live auctions, recent bids and KPIs · analytics (bids/day, sales/day, sell-through, most
contested auctions) · bike inventory with photo upload · create / edit / publish / start / end / cancel auctions ·
full bid history with bidder identities · winners list.

**Platform:** auction state machine (`DRAFT → SCHEDULED → LIVE → ENDED → ARCHIVED`, plus `CANCELLED`) driven by BullMQ
delayed jobs plus a once-a-minute reconciliation sweep · row-locked bid placement (correct under concurrency) ·
soft-close anti-sniping · rotating refresh tokens with reuse detection · audit log of admin and auth events ·
structured logs with request correlation ids · health endpoints.

## Tech stack

| Layer | Choices |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui-style components (Radix), TanStack Query, Zustand, React Hook Form + Zod, Socket.IO client, Framer Motion, Lucide, Recharts |
| Backend | Node.js 22, Express 5, TypeScript (strict), Prisma 6, PostgreSQL (Neon), Redis (ioredis), BullMQ, Socket.IO + Redis adapter, JWT, bcrypt, Zod, Pino, Helmet, CORS, express-rate-limit (Redis store) |
| Quality | Vitest, Supertest, Testing Library, ESLint (type-aware), GitHub Actions |
| Infra | Docker, Docker Compose, Vercel (web), Railway / Render (API), Neon, Redis Cloud |

## Architecture at a glance

```
Browser ──HTTPS──▶ Next.js (Vercel)
   │
   └──REST + WebSocket──▶ Express + Socket.IO + BullMQ worker  (N stateless replicas)
                              │            │
                              ▼            ▼
                     PostgreSQL (Neon)   Redis (queues · socket adapter · rate limits · cache)
```

- **Layering:** `routes → controllers → services → repositories → Prisma`. Routes only wire middleware, controllers
  only translate HTTP, services hold all business rules, and repositories are the only Prisma users. Dependencies are
  wired by hand in [`backend/src/container.ts`](backend/src/container.ts).
- **Bids** go over REST (one validation/auth/rate-limit path, clear acknowledgement). **Sockets** only fan out
  state, through one room per auction, a feed room for listings, and a private room per user.
- **Concurrency:** each bid runs in a transaction holding `SELECT … FOR UPDATE` on its auction row. Bids on the
  same auction are serialised; different auctions never contend. `UNIQUE(auction_id, amount)` is a DB-level backstop.
- **Client state:** server data in TanStack Query; socket events patch that cache directly, so there is a single
  source of truth. Zustand holds only the in-memory session and small UI state.

## Folder structure

```text
.
├── backend/
│   ├── prisma/                 schema.prisma, migrations/
│   ├── src/
│   │   ├── config/             env (zod-validated), db, redis, cors, cookies, constants
│   │   ├── routes/             URL → middleware → controller
│   │   ├── controllers/        HTTP ⇄ service translation
│   │   ├── services/           business rules (auction-rules.ts is pure and fully unit-tested)
│   │   ├── repositories/       Prisma queries
│   │   ├── middlewares/        auth, roles, validation, CSRF, rate limits, upload, errors, logging
│   │   ├── validators/         zod schemas for body / params / query
│   │   ├── socket/             Socket.IO server + realtime publisher
│   │   ├── jobs/               BullMQ scheduler + worker
│   │   ├── scripts/            seed
│   │   ├── types/ · utils/
│   │   ├── app.ts · container.ts · server.ts
│   └── tests/                  unit/ and integration/
├── frontend/
│   ├── app/                    routes: (site), (auth), admin, error/404 boundaries
│   ├── components/             ui/ primitives, shared/ composites
│   ├── features/               auth · auctions · me · admin  (api hooks, schemas, components)
│   ├── hooks/ · lib/ · services/ (api client, socket) · store/ (zustand) · providers/ · styles/ · types/
├── docs/ARCHITECTURE.md
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## API

All JSON responses share one envelope:

```jsonc
{ "success": true,  "data": { … }, "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
{ "success": false, "error": { "code": "BID_TOO_LOW", "message": "Bid must be at least ₹1,29,000", "details": { "minimumBid": 129000 }, "requestId": "…" } }
```

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/refresh`* · `POST /api/auth/logout`* · `GET /api/auth/me` |
| Auctions | `GET /api/auctions` (`status, q, brand, minPrice, maxPrice, minYear, maxYear, sort, page, limit`) · `GET /api/auctions/brands` · `GET /api/auctions/:id` |
| Auction admin | `POST /api/auctions` · `PATCH /api/auctions/:id` (optimistic `version`) · `DELETE /api/auctions/:id` · `POST /api/auctions/:id/{publish,unpublish,start,end,cancel}` |
| Bids | `POST /api/auctions/:id/bids` (buyers) · `GET /api/auctions/:id/bids` |
| Watchlist | `POST /api/auctions/:id/watch` · `DELETE /api/auctions/:id/watch` |
| Bikes (admin) | `GET/POST /api/bikes` · `GET/PATCH/DELETE /api/bikes/:id` · `POST /api/bikes/:id/images` (multipart) · `DELETE /api/bikes/:id/images/:imageId` |
| Me | `PATCH /api/me` · `GET /api/me/summary` · `GET /api/me/auctions?filter=active\|won\|lost\|all` · `GET /api/me/watchlist` · `GET /api/me/notifications` · `POST /api/me/notifications/:id/read` · `POST /api/me/notifications/read-all` |
| Admin | `GET /api/admin/dashboard` · `GET /api/admin/analytics?days=7\|30\|90` · `GET /api/admin/winners` |
| Health | `GET /health` (status, version, uptime, DB + Redis checks; 503 when degraded) · `GET /health/live` · `GET /health/ready` |

\* Cookie-authenticated; requires the `X-Requested-With: XMLHttpRequest` header (CSRF mitigation).

**Socket events.** Client → server: `auction:join`, `auction:leave`, `auctions:subscribe`.
Server → client: `bid:placed`, `auction:updated`, `notification:new`. Payloads are documented in
[ARCHITECTURE.md §7](docs/ARCHITECTURE.md#7-real-time-socketio).

## Running locally

**Prerequisites:** Node.js ≥ 20.11 (22 recommended), Docker.

```bash
# 1. Dependencies (Postgres on :5433, Redis on :6379)
docker compose up -d postgres redis

# 2. API
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                 # http://localhost:4000

# 3. Web (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

**Demo accounts** (from the seed):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@auctionride.dev` | `Admin@12345` |
| Buyer | `aarav@example.com` / `diya@example.com` | `Buyer@12345` |

Open two browsers as the two buyers on the same live auction to watch bids, outbid toasts and the leader badge
update in real time.

### Tests

```bash
cd backend  && npm test     # unit + integration (integration uses the auctionride_test DB, created automatically)
cd frontend && npm test     # component tests
```

Integration tests run the real Express app against Postgres, replacing only the side-effect ports (BullMQ
scheduler, Socket.IO publisher) with in-memory fakes, plus a controllable clock to test time-based rules.

## Docker

```bash
docker compose up --build
```

This starts Postgres, Redis, the API (migrations and the idempotent seed run on start) and the web app on
http://localhost:3000. Images are multi-stage and run as a non-root user. The frontend uses Next.js `standalone` output.

## Environment variables

**Backend** (`backend/.env.example` documents every variable). Validated at boot, so the process refuses to start on a bad config.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL (Neon: `-pooler` host with `?pgbouncer=true&connection_limit=10`) |
| `DIRECT_URL` | Direct Postgres URL for migrations |
| `REDIS_URL` | Redis (`rediss://` for TLS). Must use `maxmemory-policy noeviction` |
| `JWT_ACCESS_SECRET` | ≥ 32 random chars |
| `JWT_ACCESS_TTL`, `REFRESH_TOKEN_TTL_DAYS` | Token lifetimes (default `15m`, `7`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `COOKIE_SAME_SITE`, `COOKIE_SECURE` | `lax` for same-site deployments; `none` + `true` when web and API are on different sites |
| `TRUST_PROXY` | Number of proxies in front (needed for correct client IPs in rate limiting) |
| `RUN_WORKERS`, `WORKER_CONCURRENCY` | Run BullMQ workers in this process |
| `SOFT_CLOSE_WINDOW_SECONDS`, `SOFT_CLOSE_EXTENSION_SECONDS`, `MAX_SOFT_CLOSE_EXTENSIONS` | Anti-sniping |
| `ARCHIVE_AFTER_HOURS` | Delay before ended auctions are archived |
| `PUBLIC_API_URL`, `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Image storage |

**Frontend:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` (inlined at build time).

## Deployment

1. **Database:** create a Neon project; set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
2. **Redis:** create a Redis Cloud database with eviction policy `noeviction`; set `REDIS_URL`.
3. **API (Railway / Render):** deploy `backend/` with its Dockerfile. Set the env vars above with
   `NODE_ENV=production`, `TRUST_PROXY=1`, `CORS_ORIGINS=https://<your-vercel-domain>`, and
   `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true` if the API is on a different site than the web app. Run
   `npx prisma migrate deploy` as the release/pre-deploy command. Health check path: `/health/ready`.
4. **Web (Vercel):** import `frontend/`, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to the API URL.
5. **Images:** local disk is fine for a single instance. For multiple replicas, implement the `StorageProvider`
   port with S3/R2 + CDN ([`backend/src/types/ports.ts`](backend/src/types/ports.ts)).

## Trade-offs

| Decision | Why | Cost |
|---|---|---|
| Postgres row lock sequences bids | Strong consistency with little code, easy to audit | One hot auction is bounded by single-row lock throughput (hundreds of bids/sec) |
| Workers run inside the API process | One deployable; broadcasts reuse the Socket.IO Redis adapter | Jobs share CPU with HTTP traffic |
| Access token in memory, refresh token in an httpOnly cookie | Not readable by injected scripts, not CSRF-able | One refresh call per full page load |
| Client-side route guards | Works with a cross-origin API and in-memory tokens | Guarded shells render a skeleton briefly; the API stays the authority |
| Whole-rupee integer money | Simple and exact | No paise |
| Local image storage behind an interface | Zero-config development | Needs an object-storage provider for multi-replica production |

## Future improvements

- S3/R2 `StorageProvider` with signed uploads and image resizing.
- Dedicated worker deployment publishing via `@socket.io/redis-emitter`.
- Proxy (max) bidding and bid retraction rules.
- Prometheus `/metrics` (request latency, bid latency, queue depth, socket count) and OpenTelemetry tracing.
- Postgres full-text / `pg_trgm` search; read replica for listings and analytics.
- Email / push notifications, KYC and payment escrow for winners.
- Playwright end-to-end tests for the two-bidder flow.

## Assumptions

Currency is INR in whole rupees · one winner per auction · ended or cancelled auctions are never reopened (relist as a
new auction) · a bike has at most one active auction · reserve price is optional and hidden from buyers · admins cannot
bid and buyers cannot outbid themselves · all times are stored in UTC and shown in the viewer's time zone ·
registration creates buyers only; admins are provisioned by seed.
