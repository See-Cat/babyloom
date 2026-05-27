# P9 — Deployment: Dockerfile + docker-compose + nginx + First-Run

**Goal:** Make BabyLoom actually deployable on the target QNAP NAS per spec §10. Produces a single-container app + nginx sidecar + `data/` volume layout. After P9 a user can `docker compose up -d` on a clean NAS and reach the app.

## State of the world (recon already done by reading code, 2026-05-17)
**Already shipped, do NOT re-implement:**
- `instrumentation.ts` + `instrumentation.node.ts` — full boot chain (config → migrations → owner bootstrap → reconcile worker), gated on `NEXT_RUNTIME === 'nodejs'`
- `lib/config/{load,schema}.ts` — zod-validated config; **`app.timezone` field already present with `Asia/Shanghai` default** (consumed by P6 via `config.app.timezone`)
- `lib/bootstrap/owner.ts` — first-run owner + family seed
- `lib/db/migrate.ts` — runs at boot
- `lib/log/server.ts` — pino with REDACT_PATHS for password/token/cookie/authorization/passwordHash/apiKey; writes both stdout + `data/logs/app-YYYY-MM-DD.log`. **No rotation/pruning** — that's still on the P9 todo list below.
- `lib/media/reconcile.ts` — `startReconcileWorker` runs at boot, ticks every 24h, env-gated for tests
- `app/api/health/route.ts` — pings DB and awaits `ensureStartup()`; returns 503 on failure

**Remaining gap (this plan's actual scope):** Docker image, compose stack, nginx config, `config.yaml.example`, log rotation/pruning, security response headers, `/api/log/client` endpoint + browser error reporter, `output: 'standalone'`.

## Scope IN
- `Dockerfile` (multi-stage: deps → builder → runner). Runner contains ffmpeg (P3 dep), runs `node server.js` from Next.js `output: 'standalone'`.
- `next.config.{js,ts}`: enable `output: 'standalone'` if not already
- `docker-compose.yml` per spec §10.2
- `nginx/nginx.conf` per spec §10.3 (reverse proxy app:3000, `client_max_body_size 200M`, HTTP/2, gzip)
- `config.yaml.example` checked into repo. The loader + schema **already exist** at `lib/config/{load,schema}.ts` — verify the example matches the current schema (owner/family/app/log/media sections; `app.timezone` defaulted) and nothing more.
- **Log rotation**: extend `lib/log/server.ts` to prune `data/logs/app-*.log` older than 30 days at boot (single fn call from `instrumentation.node.ts`). **No `pino-roll`** — current setup writes daily-named files which already partition by day; we just need to delete the old ones. Adding `pino-roll` would replace working code for marginal benefit.
- **`/api/log/client`** endpoint + browser error reporter (currently absent). `POST` accepts `{ message, stack?, url?, userAgent? }`, zod-validated (max 4KB), logs via existing pino as `module: 'client'`. Wire `window.onerror` + a single React `ErrorBoundary` at app root.
- **Rate-limit `/api/log/client`**: in-memory token bucket per `userId`, 60 req/min, drop overflow silently with 429.
- **Security response headers** via Next.js `middleware.ts` (the repo already has a `middleware.ts`, just extend it — single source). Adds:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - baseline CSP: `default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`
  - HSTS = user's reverse-proxy job (we don't terminate TLS); document in README.
  - **`'unsafe-inline'` for styles is a deliberate compromise** — Tailwind v4 + Next.js 15 nonce integration is ~half-day work and not turn-key; deferred to P9 follow-up. Other XSS defenses (React auto-escape, P3 magic-byte MIME sniff, media sandbox CSP) remain in place.
- Rate limiter on `/api/log/client` (deferred from P7): simple in-memory token bucket per user, 60 req/min. No third-party lib.
- `Makefile` or `package.json` scripts:
  - `pnpm docker:build` — `docker build -t babyloom:local .`
  - `pnpm docker:up` — `docker compose up -d`
  - `pnpm docker:logs` — `docker compose logs -f app`
- `.dockerignore` (must exclude `data/`, `node_modules`, `.next`, `.git`)
- Healthcheck endpoint `/api/health` — confirm DB ping + writable `data/` dir; wired into docker-compose `healthcheck`.
- README "Deploy on QNAP" section (5-step quickstart).
- Tests:
  - Dockerfile builds in CI (one job, `docker build`)
  - Built image starts, `/api/health` returns 200 in <10s
  - First-run flow: empty `data/` + a fixture `config.yaml` → owner is seeded, log line emitted, login works with the configured credentials
  - Missing config → container exits non-zero with the expected stderr message

## Scope OUT
- HTTPS / cert provisioning — let the NAS owner front it with their own reverse proxy or Let's Encrypt setup. Document this in README.
- Auto-update mechanism (Watchtower etc.) — defer
- Multi-arch image build (`amd64` + `arm64`) — only build whatever the deploy target is on first; multi-arch is a CI follow-up
- Database migration runner UI — `drizzle-kit migrate` runs at container start (one-shot), no UI
- Crash-loop diagnostics page — exposing the latest fatal in a web UI is out; the user reads `docker logs`
- Backup scheduling (still deferred from P7)
- Performance tuning, CDN, image-asset offload

## Spec sections covered
- §9.5 redact — **already done** (`lib/log/server.ts:10-23`); P9 only verifies
- §9.6 `/api/log/client` — **NEW in P9**
- §9.7 log file path — **already done** (`lib/log/server.ts:25-27`); P9 adds 30-day pruning
- §10.1 Dockerfile — NEW
- §10.2 docker-compose.yml — NEW
- §10.3 nginx — NEW
- §8.3 首次部署 — bootstrap **already done**; P9 ships `config.yaml.example` so users have something to copy

## File Structure (new)
```
Dockerfile                                  NEW
.dockerignore                               NEW
docker-compose.yml                          NEW
nginx/nginx.conf                            NEW
config.yaml.example                         NEW
scripts/docker-smoke.sh                     NEW
app/api/log/client/route.ts                 NEW
lib/client/error-reporter.ts                NEW
lib/log/prune.ts                            NEW — daily log retention
middleware.ts                               EDIT — add security headers
next.config.{js,ts}                         EDIT — output: 'standalone'
instrumentation.node.ts                     EDIT — call pruneOldLogs() on boot
lib/log/server.ts                           — keep as-is (verify only)
lib/config/{load,schema}.ts                 — keep as-is (verify only)
lib/bootstrap/owner.ts                      — keep as-is (verify only)
lib/media/reconcile.ts                      — keep as-is (verify only)
app/api/health/route.ts                     — keep as-is (verify only)
```

## Dependencies
- P0 foundation: Next.js + better-sqlite3 + drizzle-kit
- P3 media: ffmpeg dependency declared
- P7 logger + redact: if shipped, reuse; if not, ship here (move the tasks across — order them in the same commit)

---

## Phase 0 — Recon (mostly done; this phase is verification)

- [ ] **0.1** Check `next.config.{js,ts}` for `output: 'standalone'`. If absent, add. Required for the slim runner image.
- [ ] **0.2** Audit `package.json` for the ffmpeg setup P3 uses (system `ffmpeg` via apk vs `ffmpeg-static` npm). Determine whether Dockerfile needs `apk add ffmpeg` (system path) or `COPY` the static binary.
- [ ] **0.3** Confirm `lib/db/client.ts` resolves `dataDir` from `BABYLOOM_DATA_DIR` env var (existing pages do). Container will export `BABYLOOM_DATA_DIR=/app/data`.
- [ ] **0.4** Confirm `instrumentation.node.ts:startup()` runs **before** the HTTP server accepts requests, by Next.js contract. Already verified by `/api/health` route awaiting `ensureStartup()`; document in plan notes.
- [ ] **0.5** Confirm `lib/log/server.ts` writes today's file — yes (`todayLogFile()` derives from `new Date().toISOString().slice(0, 10)`). **Gap**: filename is computed once at logger creation; if the process lives across midnight, logs keep going to yesterday's file. Decide: accept (NAS family case rarely runs > 24h without restart? unlikely) → must fix in Phase 2.
- [ ] **0.6** Confirm no `/api/log/client` exists (`find app/api -type d`). If a stub exists, fold this plan's work into it.

**Phase exit:** Notes file `_p9-recon.md`. No code changes yet.

---

## Phase 1 — Dockerization

- [ ] **1.1** `config.yaml.example` matching the **actual** zod schema at `lib/config/schema.ts`:
  ```yaml
  owner:
    username: babyloom
    password: change-me-on-first-login
    nickname: 家长
  family:
    name: 我的家
  app:
    baseUrl: http://localhost
    secret: change-me-to-at-least-32-random-characters
    # timezone: Asia/Shanghai          (optional, default Asia/Shanghai; IANA tz id)
  # log:
  #   level: info                       (optional, default info)
  # media:                              (optional; defaults are 50MB photo / 500MB video)
  #   maxPhotoBytes: 50000000
  #   maxVideoBytes: 500000000
  ```
- [ ] **1.2** `next.config.{js,ts}` — add `output: 'standalone'`.
- [ ] **1.3** Manual sanity: `pnpm build` succeeds; `.next/standalone/server.js` exists.

**Phase exit:** Build-time artifacts ready. Commit `feat(P9): config.yaml.example + standalone build`.

---

## Phase 2 — Log rotation + midnight-rollover + client log endpoint + rate-limit

- [ ] **2.1** Fix midnight rollover in `lib/log/server.ts`: change the file transport to compute the path lazily per-write, or schedule a `setInterval` that calls `createLogger` again at midnight. **Simplest fix**: write to `data/logs/app-current.log` and run a daily rename job at 00:05 that moves it to `app-YYYY-MM-DD.log`. Decide which during Phase 0; prefer the simpler one.
- [ ] **2.2** `lib/log/prune.ts` `pruneOldLogs({ logsDir, keepDays = 30 })`:
  - read `logsDir`, filter `app-*.log` files older than `keepDays`, `unlink` each
  - swallow errors per file, log a single summary line at the end
- [ ] **2.3** In `instrumentation.node.ts`, after `createLogger(...)`, call `pruneOldLogs({ logsDir: join(dataDir, 'logs') })`. Also schedule it every 24h via `setInterval` (with `unref()`).
- [ ] **2.4** `app/api/log/client/route.ts`: `POST` handler. zod schema `{ message: z.string().max(4000), stack: z.string().max(8000).optional(), url: z.string().url().optional(), userAgent: z.string().max(500).optional() }`. Resolves session (user may be unauthenticated; that's OK — log with `userId: null`). Logs at `error` with `module: 'client'`. Returns 204.
- [ ] **2.5** Rate limit in same route: in-memory `Map<string, { count: number; windowStart: number }>` keyed by `userId ?? ip`; cap 60/min; on overflow return 429 (no body). Do not log the rate-limit hits as errors (would create feedback loop).
- [ ] **2.6** `lib/client/error-reporter.ts`:
  - exports `installErrorReporter()` — wires `window.onerror` and `window.onunhandledrejection`
  - debounces identical messages within 5s (avoid spamming on render loops)
  - silently drops when `navigator.onLine === false`
- [ ] **2.7** React `ErrorBoundary` component used at app root in `app/layout.tsx`; on error → POST to `/api/log/client`.
- [ ] **2.8** Tests: prune deletes files older than N days; rate limiter rejects 61st request; error reporter dedupes within window.

**Phase exit:** Log pipeline production-ready. Commit `feat(P9): log rotation/pruning + /api/log/client + browser reporter`.

---

---

## Phase 3 — Healthcheck + Dockerfile

- [ ] **3.1** `app/api/health/route.ts` — **already shipped**; just verify the response shape matches what `HEALTHCHECK` line in Phase 3.2 expects.
- [ ] **3.2** `Dockerfile`:
  ```
  # syntax=docker/dockerfile:1.7
  FROM node:22-alpine AS deps
  WORKDIR /app
  COPY package.json pnpm-lock.yaml ./
  RUN corepack enable && pnpm install --frozen-lockfile

  FROM node:22-alpine AS builder
  WORKDIR /app
  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  RUN corepack enable && pnpm build && pnpm drizzle-kit generate

  FROM node:22-alpine AS runner
  WORKDIR /app
  RUN apk add --no-cache ffmpeg
  ENV NODE_ENV=production
  ENV BABYLOOM_DATA_DIR=/app/data
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/drizzle ./drizzle
  EXPOSE 3000
  HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
  CMD ["node", "server.js"]
  ```
  Adapt paths if `drizzle-kit` output dir differs.
- [ ] **3.3** `.dockerignore`:
  ```
  .git
  .next
  node_modules
  data
  .env*
  docs
  *.log
  ```
- [ ] **3.4** Run `docker build -t babyloom:local .` locally → image builds. Run `docker run --rm -v $PWD/data:/app/data -p 3000:3000 babyloom:local` → `/api/health` returns 200.

**Phase exit:** Image is runnable. Commit `feat(P9): production Dockerfile + healthcheck`.

---

## Phase 4 — docker-compose + nginx + first-deploy smoke

- [ ] **4.1** `docker-compose.yml` per spec §10.2 (paste verbatim from spec; only adjust if names diverge).
- [ ] **4.2** `nginx/nginx.conf` per spec §10.3:
  - upstream `app:3000`
  - `client_max_body_size 200M;`
  - http2 + gzip basic mime list
  - location `/` proxy_pass, preserve `X-Forwarded-*`
  - `/api/media/` set longer `proxy_read_timeout` (videos)
- [ ] **4.2b** **Security headers** — pick one source of truth. Recommended: Next.js `middleware.ts` (so headers travel with the app even if someone fronts it with a different reverse proxy):
  ```ts
  // middleware.ts (add to existing one — already exists in this repo per gitStatus)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
    "script-src 'self'; style-src 'self' 'unsafe-inline'; " +    // unsafe-inline for Tailwind injected styles; tighten with nonce later
    "object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
  );
  ```
  Document HSTS as the user's reverse-proxy responsibility (we don't terminate TLS). **Do not** duplicate these in nginx — one place only.
- [ ] **4.2c** Test: `curl -I http://localhost/` shows all 5 headers above. Add a Playwright spec that asserts response headers on `/timeline`.
- [ ] **4.3** `scripts/docker-smoke.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  rm -rf data
  mkdir -p data
  cp config.yaml.example config.yaml
  docker compose up -d
  for i in {1..30}; do
    if curl -fs http://localhost/api/health >/dev/null; then break; fi
    sleep 1
  done
  curl -fs http://localhost/api/health
  docker compose down
  ```
- [ ] **4.4** CI job `docker-smoke`: runs the smoke script. Failing job blocks the merge.

**Phase exit:** Full stack boots from clean slate. Commit `feat(P9): docker-compose + nginx + smoke test`.

---

## Phase 5 — Docs + verification

- [ ] **5.1** README "Deploy on QNAP" quickstart (5 steps): clone, copy `config.yaml.example` → edit, `docker compose up -d`, browse `http://<nas-ip>`, log in. **Explicitly call out**: set `app.baseUrl` to the actual NAS-accessible URL (e.g. `http://192.168.1.10` or `https://baby.mynas.local`) — better-auth uses this to validate cookies and build callback URLs, so leaving the default `http://localhost:3000` will break login from any device that isn't the NAS itself.
- [ ] **5.2** README note: "BabyLoom does not handle HTTPS. Front it with your NAS's reverse proxy or a Caddy/Traefik sidecar." Provide a Caddy snippet for reference.
- [ ] **5.3** README note: "Daily logs live at `data/logs/`. Backups are produced via `/profile/data` (owner only)."
- [ ] **5.4** Manual deploy onto the actual NAS (or a Linux VM) end-to-end. Capture any drift from the planned commands and fix here, not in a follow-up.
- [ ] **5.5** Commit `chore(P9): deploy docs + manual smoke complete`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Logger writes to yesterday's file across midnight (existing bug in `lib/log/server.ts:25-27` — filename is captured at create time) | Phase 2.1 fixes it. Without the fix, log retention pruning still works but logs are mis-dated by up to 24h. |
| `output: 'standalone'` mis-bundles a runtime dependency (e.g. better-sqlite3 native) | Phase 3 verifies by actually running the built image, not just by `docker build` succeeding. If a runtime require fails, add it to `outputFileTracingIncludes` in `next.config.ts`. |
| ffmpeg-static vs apk ffmpeg version drift | Pick one and stick with it. Spec says ffmpeg-static; apk `ffmpeg` is fine and ~30MB smaller. Either works — document the choice. |
| First-run bootstrap races a concurrent request | `instrumentation.register()` runs before the HTTP server accepts connections. Confirmed via Next.js docs (Phase 0 task to verify). |
| `instrumentation.ts` runs in both edge and node runtimes | Guard with `process.env.NEXT_RUNTIME === 'nodejs'` (already in the snippet). |
| QNAP's Docker doesn't support `healthcheck` syntax v3 | Test on the actual target before declaring done. Fallback: use external healthcheck via uptime monitor. |
| Daily log rotation fills disk if a runaway error spams | `pino-roll` keeps 30 days × daily cap is implicit by traffic. P-future: add per-file size cap if needed. |
| Drizzle migrations need a separate step | If `drizzle-kit migrate` is required at runtime (not just at build), add a `pnpm db:migrate` step into the runner's `CMD` chain or a tiny `entrypoint.sh`. Recon Phase 0.2 determines which. |

## Estimated diff
~400 LOC + Dockerfile + compose + nginx config + scripts + README. ~1 focused day (down from original ~600 LOC / 1.5 days because config/bootstrap/reconcile/logger/healthcheck are already shipped).
