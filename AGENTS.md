# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

Babyloom is a self-hosted family baby-tracking PWA. It is a **single Next.js App Router monolith** — pages, API Route Handlers, PWA, and service worker all run in one process. Persistence is local SQLite (via Drizzle); media files live on disk. There is no separate backend service, no PostgreSQL. Auth is better-auth with cookie sessions.

Deeper docs live in [`docs/`](docs/) (architecture, database, api, configuration, deployment, design-system). Historical specs/plans live in `.dev-docs/`.

## Keep docs in sync with code

When a change affects what the docs describe — module layout, routes, schema/tables, config fields, npm scripts, the permission model, the media/PWA pipeline, design tokens — update the relevant file under `docs/` (and `README.md` / this file if applicable) **in the same change**. Do not leave docs describing an older version.

Follow the docs' own maintenance rules ([`docs/README.md`](docs/README.md)): source of truth is the code, so describe concepts/relationships and point to source paths rather than enumerating exhaustive field/route/token/component lists that drift. Before claiming a doc is accurate, verify the paths, tokens, table names, and routes it mentions actually exist in the code — do not copy claims forward from older docs unchecked.

## Commands

Package manager is **pnpm**. Node 22.

```bash
pnpm dev                    # local dev server (http://localhost:3000)
pnpm build                  # production build (Next.js standalone)
pnpm start                  # start the production server (requires build first)
pnpm lint                   # ESLint over app/ components/ lib/
pnpm typecheck              # tsc --noEmit
pnpm build:icons            # regenerate PWA icons
pnpm test                   # Vitest run (unit/integration, node env)
pnpm test:watch             # Vitest watch
pnpm test:e2e               # Playwright e2e

# docker (see docs/deployment.md for the deploy flow)
pnpm docker:build           # build babyloom:local
pnpm docker:up              # docker compose up -d
pnpm docker:logs            # docker compose logs -f app
pnpm docker:release         # [recommended] interactive version picker -> auto commit/tag -> push image
pnpm docker:push            # push image directly when the version is already known (docker:release's underlying step)

# single tests
pnpm vitest run path/to/file.test.ts          # one file
pnpm vitest run -t "test name substring"       # by name
pnpm playwright test tests/e2e/pwa.spec.ts     # one e2e file
```

Migrations are authored by hand as SQL files under `lib/server/db/migrations/` and applied automatically at startup via `lib/server/db/migrate.ts` — there is no `db:*` npm script and no `drizzle-kit` step. See the "Gotcha" section below for the workflow.

Tests are colocated as `*.test.ts(x)` next to source; e2e specs are in `tests/e2e/`. Vitest setup is `tests/setup.ts`. Many backend tests spin up a temp data dir (`mkdtemp` + `BABYLOOM_DATA_DIR`), so they exercise the real SQLite + migration path rather than mocks.

`@/*` is a path alias to the repo root.

## Configuration is the source of truth for the owner

`data/config.yaml` (copied from `config.yaml.example`) drives runtime config. At startup, `lib/server/bootstrap/` reads it, opens SQLite, applies pending migrations, then **injects/updates the owner account from the yaml**. Consequences:

- To change the owner username/password/nickname or family name, edit `data/config.yaml` and **restart** — there is no UI for it, and editing the DB directly will be overwritten.
- `app.secret` (≥32 chars) signs sessions; `app.baseUrl` must be the address other devices actually reach (not `localhost`) or cookies break.
- The whole data dir (`config.yaml`, `db/`, `media/`, `logs/`) is relocatable via `BABYLOOM_DATA_DIR` (default `./data`).

## Enforced invariants (custom ESLint rules in `eslint-rules/`)

These encode security/architecture rules — `pnpm lint` blocks violations. Honor them rather than working around them:

- **`api-route-must-assert`** — every API route HTTP-method export must be `export const GET = withAuthorizedResource(...)(handler)` (or `withAuthorizedAction` / `withAuthorizedActionRoute`). Direct `export async function GET()` is forbidden. These wrappers (in `lib/server/permissions/`) centralize authorization; a new route without one will not lint. A tiny exempt list lives in the rule file.
- **`parent-chain-join`** — any Drizzle query starting `from(<tenant table>)` must join `babies` (tenant scoping) or carry a `// PARENT-CHAIN-EXEMPT: <reason>` comment. This prevents cross-family data leaks.
- **`no-raw-color`** — no hex/`rgb()` literals in `app/` or `components/`. Use `var(--color-*)` tokens; add new tokens in `app/styles/tokens.css`.

## Permission model

Two-tier: a single **owner** (from config) with full rights over everything and member-only powers (creating/resetting member accounts, backups, logs); **members** get per-baby permission bits (view/edit/manage) stored in `babyMemberPermissions`. Enforcement is centralized in `lib/server/permissions/` and applied via the route wrappers above.

## Other architectural notes

- **`lib/client/` vs `lib/server/`** — browser-only vs server-only modules. Write operations (create/edit/upload/delete/backup) are gated online by `lib/client/require-online`; offline gives a read-only experience via the service worker. There is no offline write queue.
- **Media pipeline** — `app/api/media/` uses `formidable` for multipart upload, then `sharp` (image variants) and ffmpeg (`fluent-ffmpeg` + `ffmpeg-static`/`ffprobe-static`, video covers); records land in `media` + `entryMedia`. Size limits (`media.max*Bytes`) are enforced server-side (413 on exceed).
- **Soft delete** — babies/entries/media use a `deletedAt` timestamp; trash bin (`lib/server/trash/`) restores or purges (purge physically removes rows and media files).
- **PWA** — Serwist builds the service worker from `app/sw.ts` to `public/sw.js`. `public/sw.js` is a build artifact; never hand-edit it.

## Gotcha: migrations are hand-written SQL

There is no `drizzle-kit generate` step and no `drizzle.config.ts` — schema migrations are **hand-written SQL** under `lib/server/db/migrations/` (numbered `000X_xxx.sql`, with a matching entry appended to `meta/_journal.json`). The runtime migrator `lib/server/db/migrate.ts` applies any pending files automatically at startup, both in dev and production. When you change `lib/server/db/schema.ts`, write the corresponding SQL migration by hand rather than expecting a generator.
