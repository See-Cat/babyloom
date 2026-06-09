## 1. Schema & migration

- [ ] 1.1 Add a single-row `app_settings` table to `lib/server/db/schema.ts` with columns: `id` (text PK, constant), `mediaCleanupEnabled` (int bool, default 1), `mediaCleanupThresholdHours` (int, default 24), `mediaCleanupLastRunAt` (int, nullable), `mediaCleanupLastRunDeleted` (int, default 0), `updatedAt` (int).
- [ ] 1.2 Hand-write migration `lib/server/db/migrations/0005_app_settings.sql` (CREATE TABLE) and append its entry to `lib/server/db/migrations/meta/_journal.json` (the runtime migrator loads from `lib/server/db/migrations/` — NOT the stale `lib/db/` path in `drizzle.config.ts`; follow the 0004 pattern exactly).
- [ ] 1.3 Verify (migration applied): write/run a test that calls `runMigrations` on a fresh temp data dir and asserts the `app_settings` table exists (e.g. query `sqlite_master` or a no-op SELECT), so a missing journal entry fails loudly rather than silently leaving the table absent.

## 2. Settings module (`lib/server/settings/`)

- [ ] 2.1 Write failing tests for `getCleanupSettings()`: returns safe defaults (enabled=true, threshold=24) when the row is absent; returns stored values when present.
- [ ] 2.2 Write failing tests for `updateCleanupSettings()`: rejects threshold < 6h and > 720h (stored value unchanged); accepts in-range values; toggles enabled; creates the row on first write without throwing.
- [ ] 2.3 Write failing tests for the run-stat helper: recording lastRunAt + deletedCount persists and is read back; recording on an ABSENT row succeeds and leaves enabled/threshold at defaults (does not throw).
- [ ] 2.4 Write failing tests for column isolation (no clobber): after the owner sets enabled=false/threshold=72, a later stat write preserves those; after a stat write, a later owner change preserves lastRunAt/lastRunDeleted. Either writer may be the first writer on a fresh (upgraded) DB.
- [ ] 2.5 Implement `lib/server/settings/cleanup.ts` to make 2.1–2.4 pass: a SINGLE atomic upsert (`INSERT ... ON CONFLICT(id) DO UPDATE SET <only the caller's columns>`) shared by both writers — owner writes touch only enabled/threshold(+updatedAt); the stat writer touches only lastRunAt/lastRunDeleted(+updatedAt). Read uses default fallback when the row is absent. Export the MIN/MAX/default constants.

## 3. Reconcile worker integration

- [ ] 3.1 Write failing tests in `reconcile.test.ts`: with enabled=false, an old orphan draft is NOT trashed but stuck-pending recovery and staging GC still run; with enabled=true it is trashed.
- [ ] 3.2 Write failing tests: the threshold comes from settings (e.g. 72h keeps a 30h-old orphan; 24h trashes an older one); after a run, lastRunAt/lastRunDeleted are recorded.
- [ ] 3.2a Write a failing test for the manual override: `runReconcileOnce({ mode: 'manual' })` with the DB enabled flag OFF STILL trashes eligible orphans (the explicit owner action bypasses the `enabled` gate), while `mode: 'scheduled'` with enabled OFF does not. Both modes still skip during backup (3.4) and use the same cleanup primitive.
- [ ] 3.3 Refactor `runReconcileOnce` to accept `{ mode: 'scheduled' | 'manual' }` (default `'scheduled'`) and read settings from the module. The orphan-cleanup step runs when `mode === 'manual'` OR `enabled` is true (one shared cleanup primitive — do NOT duplicate cleanup logic in the route, to avoid drift). It uses the configured threshold and records run stats. Stuck-pending + staging GC stay unconditional. Make 3.1, 3.2, 3.2a pass.
- [ ] 3.4 Write failing tests for the two primitive-level hard guards: (a) while `setBackupInProgress(true)` is active, `runReconcileOnce` performs NO DB writes (no media status change, no run-stat update) and NO staging-dir removals; (b) with `BABYLOOM_DISABLE_MEDIA_RECONCILE=1`, `runReconcileOnce` does the same NO-OP — even with `mode: 'manual'`. Once each condition clears, a later run behaves normally.
- [ ] 3.5 Make 3.4 pass: `runReconcileOnce` returns early (no-op) at the top when `isBackupInProgress()` OR `process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE === '1'`. Both highest-tier guards (backup barrier, env kill-switch) are enforced AT THE PRIMITIVE so every entry point (scheduled tick, run-now, any future caller) is covered — not via per-caller discipline. Note: this also closes a pre-existing gap where the worker wrote during backups.
- [ ] 3.6 Verify: `BABYLOOM_DISABLE_MEDIA_RECONCILE` still prevents the worker from starting (env precedence unchanged in `instrumentation.node.ts`).

## 4. Permission action

- [ ] 4.1 Add an owner-only action `system:settings` to the `Action` type and `OWNER_ONLY_ACTIONS` in `lib/server/permissions/`.
- [ ] 4.2 Verify: a member is denied and the owner is allowed for `system:settings` (permission unit test).

## 5. Owner-only API

- [ ] 5.1 Write failing route tests — owner-only on EVERY endpoint: GET settings, PUT settings, run-now, AND eligible-count each return 404 for a member; owner gets the expected result. (Covers the eligible-count member-denial gap.)
- [ ] 5.2 Write failing route tests — env kill-switch UX + manual override on run-now: with `BABYLOOM_DISABLE_MEDIA_RECONCILE=1`, run-now returns a disabled (503) response AND no cleanup happens (the latter already guaranteed by the primitive per 3.4/3.5; the 503 is the owner-facing UX layer); with it unset and the DB enabled flag OFF, run-now (calling `runReconcileOnce({ mode: 'manual' })`) still trashes eligible orphans and updates stats.
- [ ] 5.3 Write failing route tests — backup write barrier: while a backup is in progress, PUT settings and run-now return the existing 503 (`assertWritesAllowed`) and mutate nothing; GET settings and eligible-count still succeed (reads are exempt).
- [ ] 5.4 Write failing route tests — behavior: PUT validates threshold (6–720) + persists; eligible-count returns the live preview number.
- [ ] 5.5 Implement the route(s) under `app/api/settings/media-cleanup/` using `withAuthorizedAction`/`withAuthorizedActionRoute` (action `system:settings`). PUT and run-now call `assertWritesAllowed`; run-now returns 503 when `BABYLOOM_DISABLE_MEDIA_RECONCILE` is set (UX only — the actual no-op is enforced in the primitive per 3.5), then delegates to `runReconcileOnce({ mode: 'manual' })` (no duplicated cleanup logic). Add a `// PARENT-CHAIN-EXEMPT` reason on the global eligible-count query. Make 5.1–5.4 pass.
- [ ] 5.6 Verify: `pnpm lint` passes (api-route-must-assert + parent-chain-join satisfied).

## 6. Owner panel UI

- [ ] 6.1 Add an owner-only cleanup panel under `app/profile/` (dedicated page, consistent with members/data/trash): enable toggle, threshold input (with min/max + inline validation), status block (last run time, last run deleted, live eligible-orphan count), and a "run now" button with feedback.
- [ ] 6.2 Wire the panel to the API (read on load, optimistic-safe update, run-now refresh) using existing UI primitives (Card/Switch/Button) and design tokens (no raw colors).
- [ ] 6.3 Add an entry point to the panel from the profile area; ensure it is shown only to the owner.

## 7. Docs & final verification

- [ ] 7.1 Update `docs/database.md` (new `app_settings` table + runtime-settings concept) and `docs/configuration.md` / `docs/architecture.md` (owner-controllable cleanup, env-override precedence, defaults preserve behavior).
- [ ] 7.2 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`; confirm all green.
- [ ] 7.3 Manually sanity-check the panel (toggle, threshold edit + validation error, run-now updates stats, preview count) per the testing rules.
