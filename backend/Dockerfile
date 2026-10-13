# syntax=docker/dockerfile:1.7
# Multi-stage build: compile with dev deps, ship only production deps + compiled JS.

FROM node:22-bookworm-slim AS base
WORKDIR /app
# OpenSSL is required by the Prisma query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# ─── Build ───────────────────────────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json prisma.config.ts docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
