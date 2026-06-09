## Context

Babyloom is a single Next.js App Router monolith with local SQLite (Drizzle) and a two-tier permission model (one owner from `config.yaml`, members with per-baby bits). Owner configuration today lives entirely in `data/config.yaml` and is injected at startup — there is **no runtime, UI-editable settings mechanism**. The orphan-media cleanup runs in `lib/server/media/reconcile.ts`, started by `instrumentation.node.ts` and gated only by the `BABYLOOM_DISABLE_MEDIA_RECONCILE` env var; its cadence (`setInterval` 24h) and threshold (`ORPHAN_READY_MS` 24h) are hardcoded constants.

This change adds an owner-governed, runtime-editable layer over that cleanup. It is the first feature to need DB-backed settings that change behavior without a restart.

## Goals / Non-Goals

**Goals:**
- Let the owner enable/disable the orphan cleanup, tune its threshold, see status, and run it on demand — all from `/profile`, no restart.
- Preserve today's behavior by default (enabled, 24h) so upgrades are invisible.
- Keep the change safe: soft-delete only, validated threshold, hygiene tasks always on, env kill-switch on top.

**Non-Goals:**
- A general-purpose settings framework. We add the minimum table/module that this feature needs (extensible later, not built out now).
- Configurable scan interval (deliberately out of scope; 24h cadence stays fixed).
- Any hard-delete / auto-purge / retention controls.
- Per-baby or per-member cleanup configuration.

## Decisions

### D1: DB-backed runtime settings (single-row `app_settings`), not `config.yaml`
The requirement is page-controllable + restart-free, which `config.yaml` (file edit + container restart, no UI) cannot satisfy. We add a single-row `app_settings` table with typed columns. Chosen over a generic key/value store for type-safety and Drizzle ergonomics; future settings add columns via migration (cheap — migrations auto-apply at startup). Chosen over `config.yaml` because of the restart-free UI requirement.

### D2: Settings read/write isolated in `lib/server/settings/`
A small module exposes `getCleanupSettings()` (read with default fallback) and `updateCleanupSettings()` (validate + write) plus run-stat helpers. The reconcile worker and the API both depend on this module, not on raw table access. Keeps the default-fallback and validation logic in one place.

### D3: Worker reads settings each run; cadence unchanged
`runReconcileOnce` reads `{ enabled, thresholdHours }` at the start of each run. The orphan-cleanup step is gated on `mode === 'manual' || enabled` (see D5) and uses `thresholdHours`; the stuck-pending recovery and staging GC are unconditional. After the orphan step, it records `lastRunAt` + `deletedCount`. Because cadence is not configurable, the existing `setInterval(24h)` scheduler is kept as-is — no scheduler refactor. A disabled→enabled toggle therefore takes effect at the next scheduled tick (or immediately via run-now).

### D4: Owner-only API via the existing permission templates
Add an owner-only action (e.g. `system:settings`) to `OWNER_ONLY_ACTIONS` and the `Action` type. The routes use `withAuthorizedAction` / `withAuthorizedActionRoute` so they satisfy the `api-route-must-assert` ESLint rule and reuse centralized auth. Endpoints: read settings, update settings, run-now, and an eligible-orphan count (the count query is global across the worker's scope, so it carries a `// PARENT-CHAIN-EXEMPT` reason like the reconcile worker's own queries).

### D5: Run-now ignores the enabled flag — via a `mode` param on the shared primitive
A manual run is an explicit owner action and executes one cleanup pass regardless of `enabled`; scheduled runs respect `enabled`. To express this WITHOUT duplicating cleanup logic in the route (which would drift from the worker), `runReconcileOnce` takes `{ mode: 'scheduled' | 'manual' }` (default `'scheduled'`). The orphan-cleanup step runs when `mode === 'manual' || enabled`. The run-now route delegates to `runReconcileOnce({ mode: 'manual' })` — one cleanup primitive, two entry points. Manual still honors the higher-tier guards (env kill-switch → 503 at the route; backup barrier). Considered a separate `forceOrphanCleanup` boolean; the `mode` enum reads clearer at both call sites and leaves room for future modes.

### D6: Env kill-switch enforced at the cleanup primitive (not per-caller)
`BABYLOOM_DISABLE_MEDIA_RECONCILE=1` overrides everything (above the DB `enabled` flag and above the manual run). The **authoritative guard lives inside `runReconcileOnce`**: it returns early (no-op) when the env var is set, alongside the backup-barrier early-return (D8) — so EVERY entry point (scheduled tick, run-now, any future CLI/cron/caller) is hard-stopped without each caller having to remember to re-check. The check in `instrumentation.node.ts` (worker doesn't even start) stays as an outer optimization, and the run-now route additionally returns a 503 purely as **owner-facing UX** ("ops has disabled cleanup") — but the real safety guarantee is centralized at the primitive, not the route. Tiering, highest to lowest: env kill-switch → DB enabled flag → (manual mode ignores the DB flag, never the env var). Rejected the earlier route-only guard: it made the highest-tier control depend on caller discipline.

### D8: All cleanup write paths honor the backup write barrier (endpoints AND the scheduled worker)
Settings update and run-now mutate SQLite (settings row; media soft-deletes), so they MUST call `assertWritesAllowed` and return the existing 503 during a backup — consistent with every other mutating route (`upload`, `attach`, `restore`, `trash`). The **scheduled reconcile worker** must also respect the barrier: `runReconcileOnce` returns early (a no-op) when `isBackupInProgress()`, skipping that tick. We use an early-return for the worker (not a thrown `ServiceUnavailableError`) because it is a background janitor, not an HTTP handler — skipping one 24h tick is harmless and it resumes next tick. Read paths (read settings, eligible-count) are exempt.

Severity note (so this isn't misread as high-risk later): the actual corruption risk from a concurrent worker tick is **low**, not a backup-corruption bug. Backup uses better-sqlite3's online `.backup()` (a transactionally consistent snapshot under concurrent writes), and `stageMediaFiles` copies media driven by that **snapshot** (read-only), while the worker only soft-deletes DB rows and GCs `_staging/` (never committed media files). So the worker can't actually desync the DB↔media backup. The reason to add the guard is **invariant uniformity** — "no writes during backup" should hold for every writer — and the fact that this change *adds* run-stat writes to the worker. It also closes a **pre-existing** gap (the worker already wrote during backups before this change).

### D9: Single atomic, column-isolated upsert for all `app_settings` writers
The one settings row has two independent writers (owner config: enabled/threshold; worker: run-stats) and, on an upgraded install, no row exists — so either can be the first writer. A naive read-then-insert/update risks a PK conflict or one writer clobbering the other's columns (e.g. a stat upsert resetting the owner's `enabled`). All writes therefore go through one helper using `INSERT ... ON CONFLICT(id) DO UPDATE SET <only that caller's columns>`: it creates the row with defaults on first write and never touches columns it doesn't own. Owner writes set only enabled/threshold(+updatedAt); the stat writer sets only lastRunAt/lastRunDeleted(+updatedAt). better-sqlite3 is single-connection/serial so there's no true concurrency, but the *ordering* hazard (owner change then stat write) is real, and column isolation closes it. Centralizing in the settings module (D2) keeps this contract in one place.

### D7: Preview count is computed live, not stored
The "currently eligible orphans" number is a `SELECT count(*)` under the active threshold at panel-load time, not a cached value, so it always reflects reality.

## Risks / Trade-offs

- [Owner sets an aggressive threshold and reaps active drafts] → Validation enforces a 6h floor; and the existing dedupe-clock-refresh + attach/restore rescue paths already protect drafts that are still in use. The floor plus those mitigations make a too-low threshold non-destructive in practice.
- [First runtime-settings table invites scope creep into a settings framework] → Explicit Non-Goal; ship a single typed row for this feature only.
- [Toggle-off latency: cleanup may still run once before the next tick reads the new flag] → Acceptable for a 24h-cadence janitor; run-now and the read-on-each-run design bound the staleness to one cycle. Documented.
- [`app_settings` single row could be missing/corrupt] → `getCleanupSettings()` falls back to safe defaults (enabled, 24h) when the row is absent, so the worker never breaks on missing config.
- [Exposing manual run could be spammed] → Owner-only, and the operation is idempotent (re-running finds nothing new); no additional rate-limit needed for a single-owner family app.

## Migration Plan

1. Add the `app_settings` table via a new hand-written migration (the repo's drizzle-kit CLI paths are stale; follow the existing `lib/server/db/migrations/` + `_journal.json` pattern). Runtime migrations apply at startup.
2. Defaults are provided by `getCleanupSettings()` fallback, so no data backfill is needed — an absent row means "enabled, 24h", matching prior behavior. The row is created lazily on first owner write.
3. Rollback: revert the code; the unused `app_settings` table is inert. The env kill-switch remains available throughout.

## Open Questions

- Panel placement: a dedicated `/profile/cleanup` sub-page vs a card on an existing profile/data page. Default to a small dedicated page consistent with other owner admin areas (`members`, `data`, `trash`); confirm during implementation.
