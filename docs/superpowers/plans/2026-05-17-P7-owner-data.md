# P7 — Owner Data: Backup Export + Log Viewer

**Goal:** Ship `/profile/data` (owner-only): one-shot **full backup export** producing a downloadable, self-consistent zip per spec §10.4, and `/profile/data/logs` log viewer per spec §9.7. No schema changes. Adds two owner-only API routes + one write-barrier primitive.

This is the **highest-risk non-permissions plan** because the backup flow has invariants (data sanitize + write barrier + manifest integrity) the spec spends ~200 lines on. The plan stays narrow: ship the **export path only**; restore + automatic backups are explicitly out (spec calls them "后续迭代").

## Scope IN
- `app/profile/data/page.tsx` — owner-only landing: "导出全部" button + storage stats + link to logs
- `app/profile/data/logs/page.tsx` — owner-only: last 200 lines of today's `data/logs/app-<today>.log`, filter by level / module, keyword search
- `app/api/backup/route.ts` — `POST` only, owner-only, streams the zip
- ~~`app/api/log/client/route.ts`~~ — **moved to P9** (it pairs with the pino-roll + rate-limit work and the browser error reporter, all of which are deployment-time concerns)
- `lib/backup/` — pure module: `runBackup({ dataDir })`:
  - sets process-wide `BACKUP_IN_PROGRESS` flag (in-memory boolean + mutex)
  - copies media files to `data/_backup_staging/<id>/` via hardlinks
  - `db.backup()` → snapshot db → sanitize SQL per spec §10.4 step 4 → `wal_checkpoint(TRUNCATE)`
  - emits manifest.json + streams zip + computes sha256
  - guarantees cleanup of staging on success/error
- `lib/backup/write-barrier.ts` — exported helper `assertWritesAllowed()` that throws `ServiceUnavailableError` with `Retry-After: 15` when flag is set
- Wire `assertWritesAllowed()` into the **6 write paths spec §10.4 lists**: media upload commit; entry create/edit; entry/media/baby `*:trash`; `*:restore`; `*:purge`; trash-empty
- `lib/logs/tail.ts` — read last N lines of a file efficiently (reverse-read by chunks, no full-file load)
- Owner gate: reuse `assertPermission(userId, 'system:backup')` / `'system:logs'` from P1
- Tests:
  - unit: `runBackup` produces a zip whose manifest matches files (no extras, no missing); sanitize SQL drops all `status != 'active'` / `status != 'ready'` rows; clears `sessions`, `deletedAt`, `deletedBy` (per §10.4 invariants); `assertWritesAllowed` throws when flag set
  - unit: `tail()` returns last N lines for short and long files; handles trailing newline
  - integration: while a backup is running, a parallel `media:trash` call returns 503 + Retry-After; backup completes; subsequent trash succeeds
  - Playwright: owner sees `/profile/data`; editor gets 404; download produces a zip file; logs page renders rows

## Scope OUT
- **Restore** (zip → live DB swap): spec §10.4 says "后续迭代". P7 only ships the export side and validates the produced zip *can* be restored by writing the manifest invariants — no UI/endpoint.
- **Automatic / scheduled backups**: spec §10.4 also defers. No cron, no rotation.
- Multi-file log viewer (yesterday/last week): only today's file
- Real-time log streaming (spec §9.7 "不做实时流(YAGNI)")
- Storage breakdown by baby / by month — show only `db size + media dir size + trash dir size` totals
- Backup progress bar / partial resume — single-shot, all-or-nothing

## Spec sections covered
- §9.5 (pino redact) — verify the existing logger config already redacts; do not re-implement
- §9.6 (`/api/log/client`)
- §9.7 (`/profile/data/logs`)
- §10.4 entire (write barrier + DB snapshot + sanitize SQL + manifest + invariants)
- §1011 row for `system:backup` / `system:logs` actions (owner-only)

## File Structure (new)
```
app/
├── api/
│   ├── backup/
│   │   └── route.ts
│   └── log/
│       └── client/
│           └── route.ts
└── profile/
    └── data/
        ├── page.tsx
        └── logs/
            └── page.tsx
lib/
├── backup/
│   ├── run.ts
│   ├── sanitize.ts            # the SQL block from spec §10.4 step 4
│   ├── manifest.ts
│   ├── write-barrier.ts
│   └── run.test.ts
└── logs/
    ├── tail.ts
    └── tail.test.ts
components/features/
├── BackupPanel.tsx
└── LogViewer.tsx
```

## Dependencies
- P1 permissions: `assertPermission` + `'system:backup'` / `'system:logs'` actions (verify these are in P1's `Action` union; if not, P7 Phase 0 adds them — they were listed in spec §5.4)
- P3 media: `data/media/<babyId>/...` layout, so the backup knows what to hardlink
- P5 design: Card, Button, Input, Tag, Toast for both pages

---

## Phase 0 — Recon

- [ ] **0.1** Confirm `Action` union in `lib/permissions/with-permission.ts` includes `'system:backup'` and `'system:logs'`. If missing, this is a 2-line additive change — do it in this phase, do not call it scope creep.
- [ ] **0.2** ~~Confirm pino redact~~ — **already shipped** at `lib/log/server.ts:10-23` (6 paths including `apiKey`). P9 owns any future logger work. **Drop this task.**
- [ ] **0.3** Confirm `data/logs/app-<YYYY-MM-DD>.log` is what the runtime writes today. If logs are stdout-only, file rotation needs to come first (still small; do in Phase 0).
- [ ] **0.4** ~~Verify WAL~~ — **already shipped** at `lib/db/client.ts:23-27` (all 5 §14 PRAGMAs including `journal_mode=WAL`). One-line verify.
- [ ] **0.5** Write paths that need `assertWritesAllowed()` (enumerated from `app/api/`):
  - `app/api/media/upload/route.ts` (POST — media upload commit)
  - `app/api/entries/route.ts` (POST — entry create) + `app/api/entries/[id]/route.ts` (PATCH — entry edit)
  - `app/api/entries/[id]/trash/route.ts` + `app/api/entries/[id]/restore/route.ts`
  - `app/api/media/[id]/trash/route.ts` + `app/api/media/[id]/restore/route.ts` + `app/api/media/[id]/route.ts` (DELETE — purge)
  - `app/api/babies/[id]/trash/route.ts` + `app/api/babies/[id]/restore/route.ts` + `app/api/babies/[id]/route.ts` (DELETE — purge)
  - `app/api/trash/empty/route.ts`
  - `app/api/entries/[id]/media/[mediaId]/attach/route.ts`
  Total: ~12 files, one `assertWritesAllowed()` at function top each.

**Phase exit:** Notes file `_p7-recon.md` with the write-paths list + any pre-req fixes shipped as `chore(P7): backup prerequisites`.

---

## Phase 1 — Write barrier primitive

- [ ] **1.1** `lib/backup/write-barrier.ts`: module-level `let backupInProgress = false`. Export `setBackupInProgress(v)`, `isBackupInProgress()`, `assertWritesAllowed()` (throws `ServiceUnavailableError` w/ `retryAfterSeconds: 15`).
- [ ] **1.2** Decide error shape: use the existing app error class. The route layer maps it to `503` + `Retry-After: 15`.
- [ ] **1.3** Wire `assertWritesAllowed()` into every write path from Phase 0.5. Each call is one line, at the very top of the action.
- [ ] **1.4** Unit test: flag flips → existing actions throw; flipping back → actions resume.
- [ ] **1.5** Integration test: real DB, real upload, flag flipped → upload returns 503.

**Phase exit:** Write barrier shippable on its own. Commit `feat(P7): backup write barrier`.

---

## Phase 2 — Backup core

- [ ] **2.1** `lib/backup/sanitize.ts`: exports `sanitize(snapshotDbPath)` — opens the snapshot DB, `PRAGMA foreign_keys = ON`, runs the SQL from spec §10.4 step 4 verbatim (Stage A → entry_milestones → entry_media → entries; Stage B → entry_media → media; Stage C → baby_member_permissions → babies; then clear `sessions`, `deletedAt`, `deletedBy`). Single transaction. Commit or abort.
- [ ] **2.2** `lib/backup/manifest.ts`: scans snapshot DB for surviving `media` rows, builds `{ id, relativePath, filename, sizeBytes, sha256 }[]`. sha256 is computed during the hardlink-copy step (Phase 2.4), not by re-reading files.
- [ ] **2.3** `lib/backup/run.ts` `runBackup({ dataDir, dbPath })`:
  1. `setBackupInProgress(true)`
  2. wait briefly for in-flight writes (poll a counter exposed by Phase 1; cap at 30s; if still busy, abort and `setBackupInProgress(false)`)
  3. create staging dir `data/_backup_staging/<uuid>/`
  4. `db.backup(staging/snapshot.db)` via better-sqlite3
  5. `PRAGMA wal_checkpoint(TRUNCATE)` on snapshot
  6. `sanitize(staging/snapshot.db)`
  7. for each surviving `media` row: hardlink `data/media/<rel>` → `staging/media/<rel>`; if hardlink fails (cross-filesystem), copy + sha256
  8. write `staging/manifest.json` `{ createdAt, dbSha256, files: [...] }`
  9. `setBackupInProgress(false)` (write barrier released; staging still on disk)
  10. return an async iterator that streams a zip (snapshot.db + media/... + manifest.json) and computes the overall sha256
  11. on completion or error in the iterator, `rm -rf staging/<uuid>/`
- [ ] **2.4** Use `archiver` or Node's built-in `zlib` + manual zip writer; pick whichever is already in `package.json` or smaller. If neither: `archiver` is the safer bet.
- [ ] **2.5** Unit test invariants from spec §10.4 step 4 "后置不变量":
  - every `entries.status === 'active'`, every `media.status === 'ready'`, every `babies.status === 'active'`
  - all `deletedAt` and `deletedBy` are NULL
  - `sessions` is empty
  - every `media.babyId` resolves to a surviving `babies.id` (FK closure)
  - manifest files set === media table set (bidirectional)

**Phase exit:** `runBackup` shippable as a CLI script (`pnpm tsx scripts/backup.ts`) for testing. Commit `feat(P7): backup core (sanitize + manifest + zip)`.

---

## Phase 3 — Backup HTTP endpoint + UI

- [ ] **3.1** `app/api/backup/route.ts`: `POST` handler. Owner gate via `assertPermission(userId, 'system:backup')`. Calls `runBackup`. Returns `Response(stream, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="babyloom-backup-<ts>.zip"' } })`.
- [ ] **3.2** Error handling: if `runBackup` throws before streaming starts → 500 with structured error. If it throws mid-stream → log and abort the response; the client gets a truncated file (acceptable; client can retry).
- [ ] **3.3** `app/profile/data/page.tsx` (RSC, owner-only):
  - session + role check → editor sees 404 (use `notFound()`)
  - read `data/babyloom.db` size, `data/media/` size, `data/_trash/` size if exists (simple `fs.stat` recursion in a helper)
  - render `<AppShell title="数据">` with three Cards: 存储统计 / 备份导出 / 日志查看 (link)
- [ ] **3.4** `components/features/BackupPanel.tsx` (client): single Button "导出全部"; on click, `fetch('/api/backup', { method: 'POST' })` → if 503, show toast "另一个备份正在进行,稍后再试"; if 200, trigger download via `URL.createObjectURL(blob)`; show progress as "正在打包…" spinner (no real progress %, just busy state).
- [ ] **3.5** Playwright: log in as owner → /profile/data → click 导出 → wait → assert a `.zip` was downloaded and is non-empty. Log in as editor → /profile/data → expect 404.

**Phase exit:** Backup ships end-to-end. Commit `feat(P7): /profile/data + backup endpoint`.

---

## Phase 4 — Log viewer (read-side only)

- [ ] **4.1** `lib/logs/tail.ts`: `tail(filePath, n)` reads from end via `fs.openSync` + `read()` in 64KB chunks, parses each line as JSON (pino's format), returns `Array<{ time, level, module, msg, ...}>`. Tolerates malformed lines (skip with `// silent`).
- [ ] **4.2** `app/profile/data/logs/page.tsx` (RSC, owner-only): reads `?level=`, `?module=`, `?q=`. Calls `tail()` → applies in-memory filter → renders `<LogViewer rows={...} />`.
- [ ] **4.3** `components/features/LogViewer.tsx` (client): three filter controls (level select, module select, search Input) that update URL query params via `useRouter`; table with sticky header; row color by level (warn=amber, error=red, info=default, debug=muted).
- [ ] **4.4** Playwright: visit /profile/data/logs as owner → see existing log lines from today's file. (P9 ships `/api/log/client`; if P9 lands first, also assert a `module:"client"` line shows up.)

**Phase exit:** Log viewer (read-only) complete. Commit `feat(P7): log viewer`.

---

## Phase 5 — Verify & document

- [ ] **5.1** Full test suite green.
- [ ] **5.2** Manual: produce a real backup on a seeded DB; unzip; assert manifest invariants by hand on the unzipped DB (`sqlite3 snapshot.db 'select count(*) from entries where status != "active"'` → 0).
- [ ] **5.3** Confirm spec §10.4 step 6 invariants ("后置不变量" — referenced in §1500) all hold via the unit tests in 2.5.
- [ ] **5.4** Add a one-paragraph "How to restore" note to `docs/README.md` (manual procedure: stop container, unzip into fresh data dir, start container). Restore UI is P-future.
- [ ] **5.4b** Visual regression baselines (spec §11.4) for `/profile/data` and `/profile/data/logs` at 375 / 768 / 1024.
- [ ] **5.5** Commit `chore(P7): verification + restore instructions`.

---

## Risks

| Risk | Mitigation |
|---|---|
| `BACKUP_IN_PROGRESS` is in-memory — multi-process deployments would race | Spec §10 deploys as single container / single Node process. Document this assumption inline. If we ever scale to >1 process, this becomes a file lock. |
| 30s wait for in-flight writes can hit timeout on slow uploads | Cap to 30s + abort + log. User retries. P9 will revisit if it bites in production. |
| `archiver` is heavier than we'd like | Audit `package.json` first; if a smaller lib already covers our needs, use it. Don't add a new dep just to save 50KB. |
| Cross-filesystem hardlink failure | Fall back to copy + recompute sha256 — already in the design. |
| Sanitize SQL drift from spec | Lifted verbatim into `lib/backup/sanitize.ts` with the spec section as a header comment. Any future schema change must update this file in the same PR (add to schema-change checklist in `CLAUDE.md` if not already there). |

## Estimated diff
~900 LOC across ~15 new files. ~2 focused days.
