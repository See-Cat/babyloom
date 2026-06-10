## Why

The background orphan-media cleanup (reconcile worker) currently starts automatically on deploy with hardcoded behavior: it always runs, on a fixed 24h cadence, with a fixed 24h "unsaved draft" threshold. The only switch is an ops-level env var (`BABYLOOM_DISABLE_MEDIA_RECONCILE`) that a family owner can't reach. The owner — who is responsible for their family's data — has no visibility into what the cleanup does and no way to tune or pause it. This change gives the owner a controlled, in-app panel to govern the cleanup without editing files or restarting the container.

## What Changes

- Introduce the project's **first runtime (DB-backed) app settings**, owner-editable from the UI, taking effect without a restart.
- Add an owner-only **media cleanup settings panel** under `/profile` with:
  - a master **on/off** switch for the orphan-media cleanup;
  - a configurable **threshold** (how long an unsaved draft may sit before it's eligible), validated against a safe min/max;
  - a read-only **status view**: last run time, how many were cleaned last run, and a live count of currently-eligible orphans (preview);
  - a **"run now"** button that triggers one cleanup pass on demand.
- The reconcile worker reads the enabled flag + threshold from settings on each run and records run stats (last run time, deleted count).
- **Scope guardrails (non-negotiable):**
  - the on/off switch governs **only** the orphan-media cleanup; the stuck-`pending`→`failed` recovery and the staging-dir GC are internal hygiene and **always run**;
  - the cleanup action stays **soft-delete only** (to trash, recoverable) — no hard-delete / auto-purge is exposed;
  - the env var `BABYLOOM_DISABLE_MEDIA_RECONCILE` remains a hard ops kill-switch that **overrides** the DB setting.

## Capabilities

### New Capabilities
- `media-cleanup-settings`: Owner-governed runtime configuration and status for the background orphan-media cleanup — persistence of the settings, the enforcement of those settings by the reconcile worker, the owner-only API to read/update/trigger them, and the in-app admin panel.

### Modified Capabilities
<!-- None: the orphan-cleanup behavior itself has no prior spec; this change adds its governance layer. -->

## Impact

- **Schema/DB**: new single-row `app_settings` table + migration; runtime migrations apply at startup.
- **Server**: a settings read/write module (`lib/server/settings/`); `lib/server/media/reconcile.ts` gains settings-awareness and run-stat recording; a new owner-only API (read/update settings, run-now, eligible-count preview); new owner action in the permission model (`lib/server/permissions/`).
- **Client**: a new owner-only panel under `app/profile/` (e.g. a cleanup settings page/card) using existing UI primitives.
- **Docs**: `docs/database.md` (new table + run-time settings concept), `docs/configuration.md` / `docs/architecture.md` (owner-controllable cleanup; env override precedence).
- **No breaking changes**: defaults preserve today's behavior (cleanup enabled, 24h threshold); the env kill-switch keeps working with highest precedence.
