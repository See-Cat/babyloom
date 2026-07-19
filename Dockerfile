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
# pnpm 11 runs a deps-status check before any command (incl. `pnpm build`).
# node_modules copied from the `deps` stage has broken hard-links to the
# cache-mounted store, so the check wants to purge & reinstall — which aborts
# without a TTY (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).
# - CI=true => pnpm treats confirmModulesPurge as false (no prompt needed)
# - verify-deps-before-run=false => skip the check entirely; the deps stage
#   already produced a valid node_modules for this lockfile, re-verifying is
#   pointless and would trigger a network reinstall here.
ENV CI=true
RUN corepack enable && pnpm config set verify-deps-before-run false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
# App version, injected from package.json at build time (see docker:build/push).
# Visible via `docker inspect` under Config.Env (APP_VERSION) and Config.Labels.
ARG APP_VERSION=dev
ENV NODE_ENV=production
ENV BABYLOOM_DATA_DIR=/app/data
ENV APP_VERSION=$APP_VERSION
LABEL org.opencontainers.image.version=$APP_VERSION

# The prebuilt ffmpeg-static/ffprobe-static binaries are glibc-linked and aren't
# bundled into the Next standalone output, so video probe/derive fails on Alpine.
# Use the musl-native system ffmpeg (includes ffprobe) instead; the media code
# reads these paths via FFMPEG_PATH/FFPROBE_PATH.
RUN apk add --no-cache ffmpeg
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib/server/db/migrations ./lib/server/db/migrations

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
