# P8 — Permissions Matrix UI (`/profile/members/permissions`)

**Goal:** Owner-only UI to read & write `baby_member_permissions` — the per-baby scope gate from spec §5.3. Lets the owner narrow a non-owner member's access to specific babies (e.g. "二宝的奶奶只能看二宝"). **Surfaces the spec §5.3 / §1931 trap visually**: this is a *gate*, not a *grant* — the UI must make it impossible to imply a check unlocks an owner-only action.

This is the **second-highest-risk plan** after P7. The data table is small (one row per (member, baby) pair), but the UX has to fight a natural user assumption ("I checked the delete box → they can purge") that the permission engine already rejects. The UI must mirror the engine's narrowing semantics or owner will get false impressions.

## Scope IN
- `app/profile/members/permissions/page.tsx` — owner-only, matrix UI: rows = non-owner family members, columns = active babies, cells = `{ canRead, canWrite, canDelete }` checkboxes per (member, baby). owner rows are excluded — owner always has full access.
- Server actions: `setPermissionCell(memberId, babyId, field, value)`, `clearPermissionRow(memberId, babyId)`, `resetMemberToDefault(memberId)` (= delete all rows for that member → falls back to role default = all babies).
- Visible explanation banner stating the narrowing semantic and listing the 5 always-owner actions (`*:purge`, `baby:trash/restore/purge`, `member:manage`, `family:manage`, `milestone:manage`, `system:*`) per spec §5.3.
- "Effective access" preview row per member: shows what they can actually do after override + role, computed by reusing the **same** permission helper the runtime uses — not a parallel re-implementation.
- Audit log line on every change (`info`, module `permission-config`).
- Tests:
  - unit: a viewer with `{ canDelete: 1 }` override does **NOT** gain `*:purge` (regression for §1931 finding #1). Reuse existing P1 assert tests as a base.
  - unit: server actions reject non-owner callers (404).
  - unit: setting a row to `{ 0, 0, 0 }` removes the row entirely (= "no access to this baby"); the row only exists when at least one bit is set, to keep the table semantics clean.
  - Playwright: owner toggles editor's `canWrite` for baby A → editor logs in → cannot edit entries on baby A.

## Scope OUT
- Permissions for *unowned* babies / cross-family permissions — not in the schema, not happening
- Bulk apply ("apply to all babies") — single-cell toggles only in v1
- Permission templates / presets ("only-read访客") — defer until 2nd request from real use
- History view ("who changed what when") — log line is enough for v1; a UI for it is P-future
- Inline edit of member role from this page — that lives in `/profile/members` (already shipped)

## Spec sections covered
- §5.3 entire (narrowing vs widening, owner-only actions immune to override)
- §1931 Codex round-10 finding #1 (override is gate, not grant) — the UI banner is the human-facing version of this finding
- §1011 "查 baby_member_permissions" RSC step

## File Structure (new)
```
app/profile/members/permissions/
├── page.tsx
└── actions.ts
components/features/
├── PermissionsMatrix.tsx
└── PermissionCell.tsx
lib/permissions/
└── effective.ts                # pure helper: (memberRole, override, action) → bool
                                # reuses runtime assertPermission internals
lib/db/queries/
└── permissions.ts              # list/upsert/delete baby_member_permissions
```

## Dependencies
- P1 permissions: `assertPermission`, `Action` union, `baby_member_permissions` table. **Critical**: `lib/permissions/effective.ts` must call into the *same* code path `assertPermission` uses — duplicating the matrix in the UI layer is exactly how the §1931 bug appeared. Extract a shared `evaluate(role, override, action)` pure fn during this plan if it doesn't exist.
- P2b admin: `/profile/members` already lists members — the permissions page links from there.
- P5 design: Card, Switch (or Checkbox if added), Tag, Toast.

---

## Phase 0 — Recon

- [ ] **0.1** Read `lib/permissions/with-permission.ts` end to end. Note where the role-vs-action decision is made. If it's a single function, great — extract it to `evaluate(role, override, action, ownership)` in Phase 1. If it's interleaved with DB lookups, plan an inline refactor first.
- [ ] **0.2** Confirm `babyMemberPermissions` schema. **Verified during plan-write**: table has surrogate `id` PK (not composite), columns `(familyMemberId, babyId, canRead, canWrite, canDelete)` — see `lib/db/schema.ts:119+`. **Action item**: verify there's a unique index/constraint on `(familyMemberId, babyId)` so `INSERT ... ON CONFLICT` upsert works; if missing, the first migration in this plan adds it. Without it, `upsertPermission` can silently duplicate rows.
- [ ] **0.3** Confirm existing tests cover "canDelete=1 viewer can NOT purge" (spec §1931 fix verified in P1). If a test exists, P8 references it; if not, P8 Phase 4 adds it.
- [ ] **0.4** ~~Build the gateable-vs-owner-only table~~ — **already exists** as `OWNER_ONLY_ACTIONS` Set in `lib/permissions/assert.ts:13-27`, and `babyPermBit(action)` at line 31+ maps gateable actions to their bit. P8 imports both directly; no parallel table needed. The UI's "effective access" preview reads these.

**Phase exit:** Notes in `_p8-recon.md` with the gateable-vs-owner-only action table.

---

## Phase 1 — Shared `evaluate()` helper

**Starting point** (verified in code): `assertPermission` in `lib/permissions/assert.ts` already delegates the matrix portion to `checkOwnershipMatrix(action, role, userId, resource)` — but that helper does **not** accept an `override` parameter; override handling and DB lookups are interleaved earlier in `assertPermission`. The extraction below tightens the boundary.

- [ ] **1.1** Add `evaluate({ role, override, action, ownership, userId }): { allow: boolean, reason: string }` to `lib/permissions/assert.ts`. It composes: (1) `OWNER_ONLY_ACTIONS.has(action) && role !== 'owner'` → deny; (2) override gate via `babyPermBit(action)` when action is baby-scoped; (3) `checkOwnershipMatrix` outcome (converted from throw to return). Refactor `assertPermission` to do only DB lookups then call `evaluate`.
- [ ] **1.2** Move all existing matrix tests in `lib/permissions/*.test.ts` to target `evaluate` directly where possible (they'll be faster and reusable in the UI's preview). Keep `assertPermission` integration tests that exercise the DB-lookup path.
- [ ] **1.3** New tests targeting the §1931 finding: `evaluate({ role: 'editor', override: { canDelete: 1 }, action: 'media:purge' }).allow === false`. Same for `entry:purge`, `baby:purge`, `member:manage`, `family:manage`, `milestone:manage`, `system:backup`, `system:logs`. Eight cases minimum.

**Phase exit:** `evaluate` exported, all existing permission tests still green. Commit `refactor(P8): extract permissions.evaluate()`.

---

## Phase 2 — Query layer

- [ ] **2.1** `lib/db/queries/permissions.ts`:
  - `listPermissions({ db, familyId })` → joins `family_members` × `babies` × `baby_member_permissions` → returns `Array<{ member, baby, override: { canRead, canWrite, canDelete } | null }>` (override is null when no row exists = default role).
  - `upsertPermission({ db, familyMemberId, babyId, override })` — if all three bits are 0, `delete`; else `insert ... on conflict do update`.
  - `resetMember({ db, familyMemberId })` — `delete where familyMemberId = ?`.
- [ ] **2.2** Unit tests for each query using in-memory SQLite.

**Phase exit:** Query layer green. Commit `feat(P8): permissions query layer`.

---

## Phase 3 — Server actions + page

- [ ] **3.1** `app/profile/members/permissions/actions.ts`:
  - `setPermissionCell(formData)` — owner gate via `assertPermission(userId, 'member:manage')` (re-use the existing action; `permissions` is a sub-task of member management). Validates with zod. Calls `upsertPermission`. Audit log. `revalidatePath('/profile/members/permissions')`.
  - `resetMemberRow(memberId)` — same gate; calls `resetMember`.
  - Both return `{ ok: true } | { ok: false, error }` for client-side toast handling.
- [ ] **3.2** `app/profile/members/permissions/page.tsx` (RSC):
  - owner gate (else `notFound()`)
  - load active babies + non-owner members + existing override rows
  - render `<AppShell title="宝宝权限">` with:
    - **Banner Card** (yellow accent, prose): "此处的勾选只能**收窄**家庭成员的访问范围,不能授予超出其角色的权限。" + bulleted list of 5 owner-only action categories that overrides cannot grant. Reference: spec §5.3.
    - **Matrix Card** containing `<PermissionsMatrix members={...} babies={...} overrides={...} />`
- [ ] **3.3** `components/features/PermissionsMatrix.tsx` (client):
  - Renders a table: rows = members (with role tag), columns = babies. Sticky first column.
  - Each cell is a `<PermissionCell member baby override />` with 3 inline switches labeled 看 / 写 / 删.
  - When no override row exists, switches show as "默认(按角色)" with a dotted border — toggling the first switch creates the row.
  - "重置为默认" button per row deletes the override.
- [ ] **3.4** `components/features/PermissionCell.tsx` (client):
  - 3 small switches. On change → server action → optimistic update → toast on failure with rollback.
  - When `member.role === 'viewer'`, the 写 and 删 switches are visibly disabled with a tooltip "viewer 角色无写/删权限,即使勾选也无效" (mirrors `evaluate()` semantics so the UI never lies).

**Phase exit:** Page renders, toggles work. Commit `feat(P8): permissions matrix UI`.

---

## Phase 4 — "Effective access" preview + safety tests

- [ ] **4.1** Add a `EffectiveAccessRow` per member (collapsible by default) that calls `evaluate()` for each (action, baby) pair and renders a compact summary like `baby A: 读 写 / baby B: 读`. This is the **visible proof** that owner-only actions never appear regardless of override state.
- [ ] **4.2** Playwright e2e for the §1931 invariant from the UI side: owner toggles editor's `canDelete=1` for baby A → editor logs in → tries `DELETE /api/entries/<id>/purge` (the soft-delete + hard-delete endpoint from P4) → expects 404. The UI test is the regression net for users misreading the semantics.
- [ ] **4.3** Playwright: owner sets viewer's `canWrite=0, canRead=1` for baby A (default), then sets `canRead=0` for baby B → viewer logs in → only sees baby A in baby Tab strips across gallery/calendar/timeline.

**Phase exit:** Safety nets in place. Commit `feat(P8): effective access preview + invariant tests`.

---

## Phase 5 — Linking & verification

- [ ] **5.1** Add a `<Link>` row to `app/profile/members/page.tsx` (or `MembersAdminClient.tsx`): "宝宝权限" → `/profile/members/permissions` (owner-only, hidden for non-owners). Note: spec §8.1 names this route `/profile/family/permissions`, but the existing P2b admin uses `/profile/members/`; P8 follows the existing convention rather than rename P2b.
- [ ] **5.2** Add a `<Link>` row to the main `app/profile/page.tsx` owner section. **Insertion point**: `app/profile/page.tsx:33` already builds an owner-only links array — add `{ href: '/profile/members/permissions', label: '宝宝权限' }` to it.
- [ ] **5.3** Full test suite green; manual sanity on seeded DB.
- [ ] **5.4** Visual regression baselines (spec §11.4) for `/profile/members/permissions` at 375 / 768 / 1024 (with mixed-override fixture so the dotted-default cells render).
- [ ] **5.5** Commit `chore(P8): wire permissions page + verification`.

---

## Risks

| Risk | Mitigation |
|---|---|
| UI implies overrides can grant access | Banner Card + disabled visual state for cells that cannot affect outcome (viewer's 写/删 switches) + `EffectiveAccessRow` showing real evaluated access. Three layers of redundancy because the spec calls this "critical" (§1931). |
| Duplicating matrix logic in UI drifts from runtime | Phase 1 extracts `evaluate()` as the single source. The UI **calls** it, never re-implements. |
| Owner forgets to set permissions when adding a new baby | Default = no override row = role default applies. New babies are visible to all non-viewer members automatically. If owner wants to restrict, they explicitly add overrides. Document this in the banner. |
| In-memory optimistic updates desync with DB on error | Server action returns `{ ok, error }`; client rolls back via setState in `PermissionCell` if `ok === false` and shows toast. Standard RHF/optimistic pattern. |
| Adding a new owner-only `Action` in future plans forgets to update the banner copy | Banner lists categories, not individual actions ("硬删任何资源", "管理成员", "管理宝宝", "管理里程碑", "系统级 — 备份/日志"). Spec change checklist (CLAUDE.md) should add: "if you add a new owner-only Action, audit P8 banner + recon table." |

## Estimated diff
~700 LOC across ~8 new files + 2 edits. ~1.5 focused days.
