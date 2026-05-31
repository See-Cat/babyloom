# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache g++ make python3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY eslint-rules ./eslint-rules
RUN corepack enable \
  && pnpm config set store-dir /pnpm/store \
  && pnpm config set fetch-retries 5 \
  && pnpm config set fetch-retry-maxtimeout 120000 \
  && pnpm config set fetch-timeout 600000
# Cache mount keeps the pnpm store across builds so a flaky-network retry only
# fetches what is missing instead of re-downloading every package.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
# App version, injected from package.json at build time (see docker:build/push).
# Visible via `docker inspect` under Config.Env (APP_VERSION) and Config.Labels.
ARG APP_VERSION=dev
ENV NODE_ENV=production
ENV BABYLOOM_DATA_DIR=/app/data
ENV APP_VERSION=$APP_VERSION
LABEL org.opencontainers.image.version=$APP_VERSION

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib/server/db/migrations ./lib/server/db/migrations

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
