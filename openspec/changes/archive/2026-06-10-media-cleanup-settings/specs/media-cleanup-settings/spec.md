## ADDED Requirements

### Requirement: Persisted runtime cleanup settings

The system SHALL persist the orphan-media cleanup configuration in durable storage so it survives restarts and takes effect without editing files or restarting the process. The configuration SHALL include at least: an enabled flag, an unsaved-draft threshold (in hours), and run statistics (last run time, last run deleted count).

#### Scenario: Defaults preserve current behavior on first read

- **WHEN** the settings have never been written (fresh install or upgrade)
- **THEN** reading the settings returns enabled = true and threshold = 24 hours
- **AND** the worker behaves exactly as the previous hardcoded cleanup did

#### Scenario: Updated settings persist across restart

- **WHEN** the owner changes the enabled flag or threshold and the process later restarts
- **THEN** the restarted process reads back the owner's saved values, not the defaults

### Requirement: Conflict-safe, column-isolated writes

The single `app_settings` row has two independent writers — owner config changes (enabled/threshold) and worker run-stats (last run time/deleted count). On an upgraded install the row does not exist yet, so either writer may be the first. All writers SHALL use a single atomic upsert that, on an absent row, creates it with safe defaults, and on every write touches ONLY the columns that writer owns. Neither path SHALL throw on first creation, and neither SHALL clobber the other's columns.

#### Scenario: Stat write on an absent row

- **WHEN** no `app_settings` row exists and a cleanup run records its stats
- **THEN** the write succeeds (does not throw)
- **AND** `enabled` and `threshold` are left at their defaults (true, 24h)

#### Scenario: Owner change is preserved by a later stat write

- **WHEN** the owner has set enabled=false / threshold=72 and a subsequent cleanup run records its stats
- **THEN** the stored enabled and threshold remain false / 72 (the stat write does not reset them)

#### Scenario: Stats are preserved by a later owner change

- **WHEN** run stats have been recorded and the owner then changes the threshold
- **THEN** the stored lastRunAt / lastRunDeleted are unchanged (the settings update does not reset them)

### Requirement: Owner-only governance

The system SHALL restrict ALL cleanup-governance endpoints — reading settings, modifying settings, triggering a manual run, AND reading the eligible-orphan preview count — to the family owner. Member accounts SHALL NOT be able to read, change, or preview any of this state.

#### Scenario: Owner updates settings

- **WHEN** the owner submits a settings change through the API
- **THEN** the system persists it and returns the updated settings

#### Scenario: Member is denied on every governance endpoint

- **WHEN** a non-owner member calls the settings read, settings update, run-now, OR eligible-count endpoint
- **THEN** the system denies the request and exposes no settings, run-stats, or global eligible-orphan count
- **AND** no state is mutated

### Requirement: Threshold validation

The system SHALL validate the threshold on write and reject or clamp values outside a safe range (minimum 6 hours, maximum 720 hours) so the owner cannot configure a value that would reap drafts that are still in active composition.

#### Scenario: Below-minimum threshold is rejected

- **WHEN** the owner submits a threshold below 6 hours
- **THEN** the system rejects the change with a validation error and leaves the stored value unchanged

#### Scenario: Above-maximum threshold is rejected

- **WHEN** the owner submits a threshold above 720 hours
- **THEN** the system rejects the change with a validation error and leaves the stored value unchanged

### Requirement: Worker honors the enabled flag for orphan cleanup only

The reconcile worker SHALL skip the orphan-media cleanup step when the enabled flag is off, while ALWAYS performing the internal hygiene steps (recovering stuck `pending`/`processing` media to `failed`, and garbage-collecting staging directories) regardless of the flag.

#### Scenario: Cleanup disabled

- **WHEN** the enabled flag is off and the worker runs
- **THEN** no orphan `entry_draft` media is trashed
- **AND** stuck pending media is still recovered and orphan staging directories are still removed

#### Scenario: Cleanup enabled

- **WHEN** the enabled flag is on and the worker runs
- **THEN** eligible orphan `entry_draft` media is soft-deleted as before

### Requirement: Worker uses the configured threshold

The reconcile worker SHALL use the configured threshold (not a hardcoded constant) as the minimum age before an unattached ready `entry_draft` media is eligible for cleanup.

#### Scenario: Threshold widened

- **WHEN** the threshold is set to 72 hours and an orphan draft is 30 hours old
- **THEN** the worker does NOT trash it

#### Scenario: Threshold met

- **WHEN** the threshold is set to 24 hours and an orphan draft is older than 24 hours
- **THEN** the worker trashes it

### Requirement: Run statistics recorded

The reconcile worker SHALL record, after each run that performs orphan cleanup, the run timestamp and the number of media trashed in that run, so the owner panel can display them.

#### Scenario: Stats updated after a run

- **WHEN** a cleanup run trashes N orphan media
- **THEN** the stored "last run time" reflects that run and the stored "last run deleted count" equals N

### Requirement: Manual run-now

The system SHALL let the owner trigger a single cleanup pass on demand. A manual run SHALL execute regardless of the stored enabled flag (it is an explicit owner action) and SHALL update the run statistics. A manual run SHALL still respect the higher-tier guards: the env kill-switch (see "Environment kill-switch precedence") and the backup write barrier (see "Mutating endpoints honor the backup write barrier").

A manual run SHALL be scoped to the orphan-draft cleanup ONLY — the action the owner panel advertises. The internal hygiene (recovering stuck `pending`/`processing` media to `failed`, and garbage-collecting staging directories) is background work reserved for the scheduled worker and SHALL NOT run during a manual run, so the owner-triggered button cannot recover or purge another member's still-in-progress upload and its staging files.

#### Scenario: Owner runs cleanup on demand while the DB flag is off

- **WHEN** the stored enabled flag is off (but the env kill-switch is not set and no backup is in progress) and the owner triggers a manual run
- **THEN** the system performs one cleanup pass and updates the run statistics

#### Scenario: Manual run does not touch in-progress uploads

- **WHEN** a media row has been `processing` for longer than the stuck-pending cutoff (and has a staging directory) and the owner triggers a manual run
- **THEN** the manual run trashes eligible orphan drafts but leaves that `processing` media unchanged and its staging directory intact (stuck-pending recovery and staging GC run only on the scheduled tick)

### Requirement: Eligible-orphan preview

The system SHALL expose, for the owner panel, a live count of media that are currently eligible for cleanup under the active threshold, so the owner can preview the impact before enabling or running.

#### Scenario: Preview reflects current state

- **WHEN** the owner opens the panel and there are K eligible orphan drafts
- **THEN** the panel shows the count K

### Requirement: Environment kill-switch precedence

The system SHALL treat the `BABYLOOM_DISABLE_MEDIA_RECONCILE` environment variable as a hard override that disables ALL cleanup execution paths — the scheduled worker, the owner's manual run, and any other caller — regardless of the stored enabled flag. The manual run is a higher-tier action than the DB enabled flag, but the env kill-switch is higher still: it overrides everything. Enforcement SHALL be centralized in the shared cleanup primitive (so it cannot be bypassed by a caller that forgets to re-check), not delegated to individual call sites.

#### Scenario: Env override stops the scheduled worker

- **WHEN** `BABYLOOM_DISABLE_MEDIA_RECONCILE=1` is set and the stored enabled flag is on
- **THEN** the worker does not start and no automatic cleanup runs

#### Scenario: Env override blocks the manual run

- **WHEN** `BABYLOOM_DISABLE_MEDIA_RECONCILE=1` is set and the owner triggers a manual run
- **THEN** the system performs no cleanup and returns a disabled response (503), so the env var remains a true hard stop

#### Scenario: The cleanup primitive itself no-ops under the env override

- **WHEN** `BABYLOOM_DISABLE_MEDIA_RECONCILE=1` is set and the shared cleanup primitive is invoked directly (any mode, including manual)
- **THEN** it performs no orphan cleanup and no writes, so the guarantee holds independent of which caller invoked it

### Requirement: All cleanup write paths honor the backup write barrier

Every state-changing cleanup path SHALL respect the backup write barrier while a backup is in progress, so the "no writes during backup" invariant holds uniformly:
- the owner endpoints that mutate — updating settings and triggering a manual run — SHALL call `assertWritesAllowed` and return the existing service-unavailable (503) shape;
- the scheduled reconcile worker SHALL skip its run (perform no DB or file mutations) while a backup is in progress, resuming on a later tick.

Read-only paths (read settings, eligible-count) are exempt.

#### Scenario: Settings update blocked during backup

- **WHEN** a backup is in progress and the owner submits a settings change
- **THEN** the system rejects it with the existing 503 response and does not mutate the settings

#### Scenario: Manual run blocked during backup

- **WHEN** a backup is in progress and the owner triggers a manual run
- **THEN** the system rejects it with the existing 503 response and trashes no media

#### Scenario: Scheduled worker skips during backup

- **WHEN** a backup is in progress and a scheduled reconcile tick fires
- **THEN** the worker performs no DB writes (no media status changes, no run-stat update) and no staging-dir removals
- **AND** it runs normally on a subsequent tick once the backup has finished

### Requirement: Soft-delete only

The cleanup governed by these settings SHALL only soft-delete media (move to trash, recoverable). The system SHALL NOT expose any hard-delete or auto-purge option through these settings.

#### Scenario: Cleanup is recoverable

- **WHEN** the worker cleans an orphan under these settings
- **THEN** the media is soft-deleted (status `trashed`, recoverable from the trash bin), never physically removed
