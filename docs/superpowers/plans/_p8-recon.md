# P8 Recon Notes

## Permission Core

- Runtime permission entrypoint is `lib/permissions/assert.ts`.
- Current `assertPermission()` does DB work first:
  - looks up the caller's `family_members` row,
  - verifies `resource.babyId` belongs to the caller's family,
  - validates `member:manage` target family membership,
  - loads an optional `baby_member_permissions` override row,
  - then calls `checkOwnershipMatrix()`.
- The role/action matrix is currently pure-ish but private and throw-based. P8 should extract a public `evaluate()` helper from the same file and refactor `assertPermission()` to call it after DB lookups.

## Gateable Vs Owner-Only

- Existing owner-only set in `lib/permissions/assert.ts`:
  - `baby:write`
  - `baby:trash`
  - `baby:restore`
  - `baby:purge`
  - `entry:purge`
  - `media:purge`
  - `trash:empty`
  - `member:manage`
  - `family:manage`
  - `milestone:manage`
  - `system:logs`
  - `system:backup`
- Existing gateable baby-scoped bits:
  - `canRead`: `baby:read`, `entry:read`, `media:read`
  - `canWrite`: `entry:write`, `media:write`
  - `canDelete`: `entry:trash`, `entry:restore`, `media:trash`, `media:restore`
- Overrides are gates only: a `0` denies a role-granted action for that baby; a `1` only allows the role matrix to decide.

## Schema

- `babyMemberPermissions` has surrogate `id` PK and columns `(babyId, familyMemberId, canRead, canWrite, canDelete)`.
- Unique index exists: `uq_baby_member_perm` on `(baby_id, family_member_id)` in both `lib/db/schema.ts` and migration `0001_bitter_sally_floyd.sql`.
- No new migration is needed for the upsert prerequisite.

## Existing Tests

- `tests/lib/permissions/assert.test.ts` already covers the P1 invariant that `canDelete=1` does not widen editor permissions to purge entries/media/babies.
- P8 will add direct `evaluate()` tests for the full owner-only action set so the UI preview and runtime share a smaller pure contract.

## Plan Notes

- The Phase 3/4 wording around "owner toggles editor's `canWrite` for baby A -> editor cannot edit" is interpreted as toggling write access off for that baby, consistent with the narrowing-only semantics.
