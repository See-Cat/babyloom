# P7 Recon

- Branch: `claude/affectionate-satoshi-6703ce`
- Baseline: `pnpm test` passed before changes (45 files, 161 tests).
- `system:backup` and `system:logs` already exist in `lib/permissions/actions.ts` and `lib/permissions/assert.ts`.
- Runtime file logs already write to `data/logs/app-<YYYY-MM-DD>.log` via `lib/log/server.ts`.
- SQLite WAL is already enabled in `lib/db/client.ts`.

Write paths guarded by `assertWritesAllowed()`:

- `app/api/media/upload/route.ts`
- `app/api/entries/route.ts`
- `app/api/entries/[id]/route.ts`
- `app/api/entries/[id]/trash/route.ts`
- `app/api/entries/[id]/restore/route.ts`
- `app/api/media/[id]/trash/route.ts`
- `app/api/media/[id]/restore/route.ts`
- `app/api/media/[id]/route.ts`
- `app/api/babies/[id]/trash/route.ts`
- `app/api/babies/[id]/restore/route.ts`
- `app/api/babies/[id]/route.ts`
- `app/api/trash/empty/route.ts`
- `app/api/entries/[id]/media/[mediaId]/attach/route.ts`
