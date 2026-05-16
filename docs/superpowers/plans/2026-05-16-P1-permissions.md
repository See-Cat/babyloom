# P1 Permissions Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the full §5 permissions stack — `Action` enum, `assertPermission`, `loadAndAssertTarget` target loader, `withAuthorizedResource` API route template, `withPermission` server action wrapper, unified 404/401 response helpers, and a custom ESLint rule that forces every protected API route through the template. Extend P0's bootstrap to also create the single family and owner `family_members` row. End state: any future endpoint (P2-P4) can be guarded by importing these primitives; the ESLint rule fails CI on bare `route.ts` exports.

**Architecture:** All permission logic lives in `lib/permissions/`. The full §5.4 Action enum is defined up front even though only `baby:*` and `member:manage` actions are exercised in P1 — naming the rest now prevents drift later. `assertPermission` performs: (a) load `family_members` row, (b) optional `baby_member_permissions` override, (c) ownership matrix check, (d) throw `ForbiddenError` on fail. Every protected entry point catches `ForbiddenError` and converts to **unified 404** (§5.6) — never 403. The ESLint rule walks `app/api/**/route.ts` ASTs and rejects any HTTP-method export whose handler body doesn't reference `withAuthorizedResource` (or `assertPermission` for non-resource endpoints).

**Tech Stack additions:** `@typescript-eslint/utils` + `eslint` for the custom rule. Everything else inherited from P0.

**Scope boundaries (NOT in P1):**
- No entries / media / milestones tables (P2 / P3)
- No actual `entry:*` / `media:*` / `milestone:manage` endpoints — only `baby:read` / `baby:write` / `baby:trash` / `member:manage` get exercised
- No trash bin UI / restore flow (P4)
- No `*:purge` flow execution (rule defined in matrix, exercised in P4)
- `instrumentation.ts` startup gets ONE new step (call extended `bootstrapOwner`); no other startup changes

**Spec sections covered:** §3 partial (`families`, `family_members`, `babies`, `baby_member_permissions`); §5 full (5.1, 5.2, 5.3, 5.4, 5.5, 5.5.1, 5.5.2, 5.6, 5.7).

**Spec sections NOT covered:** §3 `entries` / `milestones` / `entry_milestones` / `entry_media` / `media` (later plans); §6 / §6A / §7 / §8 / §10 / §11 majority.

---

## File Structure

P1 adds:

```
lib/
├── db/
│   └── schema.ts                          # MODIFIED: add families, family_members, babies, baby_member_permissions
├── bootstrap/
│   └── owner.ts                           # MODIFIED: also create family + owner family_member row
├── permissions/
│   ├── actions.ts                         # NEW: Action enum + PermissionResource type
│   ├── errors.ts                          # NEW: ForbiddenError + UnauthorizedError
│   ├── responses.ts                       # NEW: jsonNotFound, jsonUnauthorized, UUID_RE
│   ├── session.ts                         # NEW: getSessionUserId(req) using better-auth API
│   ├── assert.ts                          # NEW: assertPermission implementation
│   ├── target-loaders.ts                  # NEW: loadAndAssertTarget generic loader
│   ├── route-template.ts                  # NEW: withAuthorizedResource HOF for API routes
│   └── server-action.ts                   # NEW: withPermission HOF for server actions
├── api/
│   └── babies/
│       └── [id]/route.ts                  # NEW (smoke test): GET /api/babies/[id] using the template
tests/
├── lib/
│   ├── bootstrap/
│   │   └── owner.test.ts                  # MODIFIED: assert family + family_member created
│   └── permissions/
│       ├── assert.test.ts                 # NEW: full §5.4 matrix
│       ├── target-loaders.test.ts         # NEW: loadAndAssertTarget edge cases
│       ├── route-template.test.ts         # NEW: withAuthorizedResource end-to-end (unit, no Next runtime)
│       └── server-action.test.ts          # NEW: withPermission wrapper
└── e2e/
    └── permissions.spec.ts                # NEW: HTTP-level — viewer/editor/owner against /api/babies/[id]
eslint-rules/
├── package.json                           # NEW: local pkg for the rule
├── index.js                               # NEW: rule registrar
└── api-route-must-assert.js               # NEW: the AST walker
.eslintrc.cjs                              # NEW: enable @typescript-eslint + local rule
```

---

## Task 1: Schema — add families, family_members, babies, baby_member_permissions

**Why first:** every later task needs these tables. No business behaviour, just additive columns.

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Append the four tables to `lib/db/schema.ts`**

```typescript
// Append at end of existing file:

export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const familyMembers = sqliteTable(
  'family_members',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'owner' | 'editor' | 'viewer'
    joinedAt: integer('joined_at').notNull()
  },
  (t) => ({
    uniqFamilyUser: uniqueIndex('uq_family_member_family_user').on(t.familyId, t.userId)
  })
);

export const babies = sqliteTable(
  'babies',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    birthday: text('birthday').notNull(), // ISO date
    gender: text('gender').notNull(), // 'boy' | 'girl' | 'other'
    avatarUrl: text('avatar_url'),
    status: text('status').notNull(), // 'active' | 'trashed' | 'purged'
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    deletedBy: text('deleted_by').references(() => users.id)
  },
  (t) => ({
    byFamilyStatus: index('ix_babies_family_status').on(t.familyId, t.status)
  })
);

export const babyMemberPermissions = sqliteTable(
  'baby_member_permissions',
  {
    id: text('id').primaryKey(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id, { onDelete: 'cascade' }),
    familyMemberId: text('family_member_id')
      .notNull()
      .references(() => familyMembers.id, { onDelete: 'cascade' }),
    canRead: integer('can_read').notNull().default(1),
    canWrite: integer('can_write').notNull().default(0),
    canDelete: integer('can_delete').notNull().default(0)
  },
  (t) => ({
    uniqBabyMember: uniqueIndex('uq_baby_member_perm').on(t.babyId, t.familyMemberId),
    byMember: index('ix_baby_member_perm_member').on(t.familyMemberId)
  })
);
```

- [ ] **Step 2: Add the imports at top of `lib/db/schema.ts`**

The new tables use `index` and `uniqueIndex` helpers. Ensure the import line reads:

```typescript
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
```

- [ ] **Step 3: Run typecheck to make sure FK refs resolve**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(P1): add families, family_members, babies, baby_member_permissions schemas"
```

---

## Task 2: Generate + verify migration

**Files:**
- Generated: `lib/db/migrations/000N_*.sql`

- [ ] **Step 1: Generate migration**

Run: `pnpm db:generate`
Expected: a new SQL file appears under `lib/db/migrations/` with `CREATE TABLE families`, `CREATE TABLE family_members`, `CREATE TABLE babies`, `CREATE TABLE baby_member_permissions`, plus indices.

- [ ] **Step 2: Inspect the SQL**

Run: `ls lib/db/migrations/ && cat lib/db/migrations/0001_*.sql`
Expected: all four tables present, foreign keys preserved.

- [ ] **Step 3: Apply against a scratch DB and verify**

```bash
rm -rf /tmp/babyloom-p1-smoke
BABYLOOM_DATA_DIR=/tmp/babyloom-p1-smoke pnpm db:migrate
sqlite3 /tmp/babyloom-p1-smoke/db/babyloom.sqlite ".tables"
```
Expected: tables list includes `families family_members babies baby_member_permissions` plus the P0 tables.

- [ ] **Step 4: Commit**

```bash
git add lib/db/migrations/
git commit -m "feat(P1): migration for families/family_members/babies/baby_member_permissions"
```

---

## Task 3: Extend owner bootstrap — create family + owner family_member

**Why:** Spec §4.3 step 3 says "DB 无 owner → 创建 owner user + family". P0 bootstrap creates the user + credential account. P1 extends it to also create exactly one `families` row (per `config.family.name`) and one `family_members` row putting the owner in that family.

**Critical context** (Codex round-10 finding #3): the actual P0 schema follows better-auth's 4-table layout (spec §3.2). `users` has `name/email/username/role`; credentials live in `accounts.password` with `providerId='credential'`. The owner's email is internally derived as `${username}@local.babyloom`. **Task 3 must preserve all of this** — it only adds family + family_members maintenance, it does NOT rewrite the user/account logic.

Idempotent (runs every boot).

**Files:**
- Modify: `lib/bootstrap/owner.ts` (append family + family_members logic at end of `bootstrapOwner`)
- Modify: `tests/lib/bootstrap/owner.test.ts`

- [ ] **Step 1: Extend the test first — assert family + family_member exist after bootstrap**

Open `tests/lib/bootstrap/owner.test.ts` and add the following test cases at the end of the `describe`:

```typescript
  it('creates exactly one family per config and a family_members row for the owner', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { families, familyMembers, users } = await import('@/lib/db/schema');

    const fams = db.select().from(families).all();
    expect(fams).toHaveLength(1);
    expect(fams[0].name).toBe('Test Family');

    const owner = db.select().from(users).all()[0];
    const members = db.select().from(familyMembers).all();
    expect(members).toHaveLength(1);
    expect(members[0].familyId).toBe(fams[0].id);
    expect(members[0].userId).toBe(owner.id);
    expect(members[0].role).toBe('owner');
  });

  it('is idempotent across family + family_members too', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { families, familyMembers, accounts } = await import('@/lib/db/schema');

    expect(db.select().from(families).all()).toHaveLength(1);
    expect(db.select().from(familyMembers).all()).toHaveLength(1);
    // Sanity: the P0 invariant — exactly one credential account — still holds
    expect(
      db.select().from(accounts).all().filter((a: any) => a.providerId === 'credential')
    ).toHaveLength(1);
  });

  it('updates family.name if config.family.name changed', async () => {
    const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    const { clearConfigCache } = await import('@/lib/config/load');
    clearConfigCache();
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: alice
  password: longenoughpw
  nickname: Alice
family:
  name: Renamed Family
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { families } = await import('@/lib/db/schema');
    const fams = db.select().from(families).all();
    expect(fams).toHaveLength(1);
    expect(fams[0].name).toBe('Renamed Family');
  });

  it('after username change, the owner can sign in with the new internal email (Codex round-10 regression)', async () => {
    const { bootstrapOwner, ownerInternalEmail, verifyPassword } = await import('@/lib/bootstrap/owner');
    await bootstrapOwner({ dataDir });

    // Change username + password in config
    const { clearConfigCache } = await import('@/lib/config/load');
    clearConfigCache();
    writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: bob
  password: brandnewpassword
  nickname: Bob
family:
  name: Test Family
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
    await bootstrapOwner({ dataDir });

    const { getDb } = await import('@/lib/db/client');
    const { eq, and } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });
    const { users, accounts } = await import('@/lib/db/schema');

    // user row updated
    const owner = db.select().from(users).all()[0];
    expect(owner.username).toBe('bob');
    expect(owner.email).toBe(ownerInternalEmail('bob'));

    // credential account password updated AND verifies the new password
    const cred = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, owner.id), eq(accounts.providerId, 'credential')))
      .get();
    expect(cred?.password).toBeTruthy();
    expect(verifyPassword('brandnewpassword', cred!.password!)).toBe(true);
    expect(verifyPassword('longenoughpw', cred!.password!)).toBe(false);
  });
```

Also confirm the existing P0 `beforeEach` already writes a config with `family` + `app` sections; if a stale test still uses the old `email/displayName` schema, update it to match the spec-aligned shape:

```yaml
owner:
  username: alice
  password: longenoughpw
  nickname: Alice
family:
  name: Test Family
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
```

- [ ] **Step 2: Run tests to verify new ones fail, old ones still pass**

Run: `pnpm test tests/lib/bootstrap/owner.test.ts`
Expected: the three new tests fail (families table empty); existing tests pass.

- [ ] **Step 3: Extend `lib/bootstrap/owner.ts`** — ADDITIVE only

P0's `bootstrapOwner` already correctly maintains `users` + `accounts.password` (credential) — do NOT rewrite that. **Append** family + family_members maintenance **after** the existing user/account section. Final shape:

```typescript
// ── EXISTING (P0): preserve verbatim ────────────────────────────────────
//   imports
//   hashPassword, verifyPassword, ownerInternalEmail
//   the user upsert + accounts.password upsert
// ────────────────────────────────────────────────────────────────────────

// Add these imports if not already present:
import { families, familyMembers } from '@/lib/db/schema';

// Modify bootstrapOwner to:
//   1. Do its existing user + account work (unchanged)
//   2. Capture the owner row's `id` returned from that work (refactor: the
//      existing impl already knows `userId` — either in the insert branch
//      from `randomUUID()` or in the update branch from `existing[0].id`).
//      Pull it into a local `ownerUserId: string` available to step 3.
//   3. Append the family + family_members logic below.

// At the end of bootstrapOwner (replace the early `return` in the insert
// branch with a fall-through so both branches reach this code):

// 3. Ensure exactly one family exists, owned by this owner
const existingFamilies = db.select().from(families).all();
let familyId: string;
if (existingFamilies.length === 0) {
  familyId = randomUUID();
  db.insert(families)
    .values({
      id: familyId,
      name: config.family.name,
      ownerUserId,
      createdAt: now,
      updatedAt: now
    })
    .run();
} else {
  familyId = existingFamilies[0].id;
  db.update(families)
    .set({
      name: config.family.name,
      ownerUserId,
      updatedAt: now
    })
    .where(eq(families.id, familyId))
    .run();
}

// 4. Ensure owner is a family_members row with role 'owner'
const existingMember = db
  .select()
  .from(familyMembers)
  .where(eq(familyMembers.userId, ownerUserId))
  .all();

if (existingMember.length === 0) {
  db.insert(familyMembers)
    .values({
      id: randomUUID(),
      familyId,
      userId: ownerUserId,
      role: 'owner',
      joinedAt: now
    })
    .run();
} else {
  db.update(familyMembers)
    .set({ familyId, role: 'owner' })
    .where(eq(familyMembers.id, existingMember[0].id))
    .run();
}
```

**Type note**: P0's bootstrap uses `now = new Date()` (timestamp columns on users/accounts), but `families.createdAt` and `familyMembers.joinedAt` are plain `integer` columns (P1 Task 1 schema). Pass `Date.now()` for these — not `new Date()`. Add a local at the top of the function:

```typescript
const nowMs = Date.now();
```

…and use `nowMs` in the families/familyMembers writes (vs the existing `now: Date` for users/accounts).

**Refactor reminder**: in the P0 insert branch, capture `ownerUserId = userId` immediately after the user insert. In the update branch, capture `ownerUserId = existing[0].id`. Both branches must then **fall through** to steps 3-4 (delete the existing `return` after the insert branch).

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/lib/bootstrap/owner.test.ts`
Expected: P0's 3 base tests + 4 new P1 tests = 7 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/bootstrap/owner.ts tests/lib/bootstrap/owner.test.ts
git commit -m "feat(P1): bootstrap also ensures family + owner family_members row"
```

---

## Task 4: Permission errors

**Files:**
- Create: `lib/permissions/errors.ts`

- [ ] **Step 1: Write `lib/permissions/errors.ts`**

```typescript
// Thrown by assertPermission and target loaders.
// Translated to a unified 404 at every protected entry point (§5.6).
export class ForbiddenError extends Error {
  constructor(public readonly action: string, public readonly reason: string) {
    super(`forbidden: ${action} (${reason})`);
    this.name = 'ForbiddenError';
  }
}

// Thrown when there is no authenticated session at all.
// Translated to 401. Login state is not a secret (§5.6).
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

// Thrown by target loaders when the target row does not exist,
// is in a disallowed status, or fails any DB-level constraint.
// Also translated to a unified 404.
export class NotFoundError extends Error {
  constructor(public readonly resource: string) {
    super(`not_found: ${resource}`);
    this.name = 'NotFoundError';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/permissions/errors.ts
git commit -m "feat(P1): ForbiddenError / UnauthorizedError / NotFoundError"
```

---

## Task 5: Action enum + PermissionResource type

**Files:**
- Create: `lib/permissions/actions.ts`

- [ ] **Step 1: Write `lib/permissions/actions.ts`**

```typescript
// Complete §5.4 Action set. Adding a protected resource? Add the action here FIRST,
// then the route, then the test. Anything else is a missed coverage gate.
export const ACTIONS = [
  'baby:read',
  'baby:write',
  'baby:trash',
  'baby:purge',
  'baby:restore',
  'entry:read',
  'entry:write',
  'entry:trash',
  'entry:purge',
  'entry:restore',
  'media:read',
  'media:write',
  'media:trash',
  'media:purge',
  'media:restore',
  'trash:view',
  'member:manage',
  'family:manage',
  'milestone:manage',
  'system:logs',
  'system:backup'
] as const;

export type Action = (typeof ACTIONS)[number];

export function isAction(s: string): s is Action {
  return (ACTIONS as readonly string[]).includes(s);
}

// §5.5.1 ownership vs target field carrier.
// Every field here comes from a DB loader — never from the client request body.
export interface PermissionResource {
  babyId?: string;
  entryId?: string;
  mediaId?: string;
  authorId?: string; // entry.author
  uploadedBy?: string; // media.uploadedBy
  deletedBy?: string; // for *:restore matrix
  targetUserId?: string; // member:manage subject
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/permissions/actions.ts
git commit -m "feat(P1): Action enum and PermissionResource type"
```

---

## Task 6: Response helpers + UUID regex

**Files:**
- Create: `lib/permissions/responses.ts`

- [ ] **Step 1: Write `lib/permissions/responses.ts`**

```typescript
import { NextResponse } from 'next/server';

// UUID v4 (loosely accepts any 8-4-4-4-12 hex with any variant)
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unified 404 body — §5.6 forbids leaking presence/absence/permission distinction.
export function jsonNotFound() {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

// 401 is only for "no session at all" — login state is not a secret.
export function jsonUnauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

// 400 — only for shape errors that are not 404-worthy
// (e.g. unknown query parameter values like ?size=poster on a photo).
// Path-id shape errors collapse to 404, not 400.
export function jsonBadRequest(detail: string) {
  return NextResponse.json({ error: 'bad_request', detail }, { status: 400 });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/permissions/responses.ts
git commit -m "feat(P1): unified 404/401/400 response helpers + UUID_RE"
```

---

## Task 7: Session helper

**Why:** Every protected entry needs the authenticated `userId`. Centralize the better-auth call so the rest of the codebase doesn't import auth internals.

**Files:**
- Create: `lib/permissions/session.ts`

- [ ] **Step 1: Write `lib/permissions/session.ts`**

```typescript
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { UnauthorizedError } from './errors';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export async function getSessionUserId(req: Request): Promise<string> {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}

// Variant for server actions / RSC where `headers()` is the source.
export async function getSessionUserIdFromHeaders(
  headers: Headers | Promise<Headers>
): Promise<string> {
  const auth = getAuth({ dataDir });
  const h = headers instanceof Headers ? headers : await headers;
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/permissions/session.ts
git commit -m "feat(P1): getSessionUserId helpers for routes and server actions"
```

---

## Task 8: assertPermission core

**Why:** The matrix engine — §5.2 + §5.4 ownership rules collapse into one function. Pure DB lookup, no IO beyond that.

**Files:**
- Create: `lib/permissions/assert.ts`

- [ ] **Step 1: Write `lib/permissions/assert.ts`**

```typescript
import { and, eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { familyMembers, babyMemberPermissions, babies } from '@/lib/db/schema';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError } from './errors';

export interface AssertPermissionOptions {
  dataDir?: string;
}

// Owner-only actions (spec §5.4 right column).
// These IGNORE baby_member_permissions entirely — they go straight to the role matrix.
// This is the §5.3 invariant: override is a scope gate, not an authorization grant.
const OWNER_ONLY_ACTIONS = new Set<Action>([
  'baby:trash',
  'baby:restore',
  'baby:purge',
  'entry:purge',
  'media:purge',
  'member:manage',
  'family:manage',
  'milestone:manage',
  'system:logs',
  'system:backup'
]);

// Map an Action to the (canRead | canWrite | canDelete) bit it needs against baby_member_permissions.
// Returns null when the action is owner-only OR not baby-scoped — override cannot apply.
function babyPermBit(action: Action): 'canRead' | 'canWrite' | 'canDelete' | null {
  if (OWNER_ONLY_ACTIONS.has(action)) return null;
  switch (action) {
    case 'baby:read':
    case 'entry:read':
    case 'media:read':
      return 'canRead';
    case 'baby:write':
    case 'entry:write':
    case 'media:write':
      return 'canWrite';
    case 'entry:trash':
    case 'entry:restore':
    case 'media:trash':
    case 'media:restore':
      return 'canDelete';
    default:
      return null; // trash:view and other non-baby-scoped actions
  }
}

// Ownership matrix from spec §5.4.
function checkOwnershipMatrix(
  action: Action,
  role: 'owner' | 'editor' | 'viewer',
  userId: string,
  resource: PermissionResource | undefined
): void {
  if (role === 'owner') return; // owner bypasses ownership checks

  switch (action) {
    // viewer: read-only on baby/entry/media scope (see baby_member_permissions step)
    case 'baby:read':
    case 'entry:read':
    case 'media:read':
    case 'trash:view':
      return; // viewer + editor allowed; finer scope handled by baby_member_permissions

    // editor: write/trash own only
    case 'entry:write':
    case 'entry:trash':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_write');
      if (!resource?.authorId || resource.authorId !== userId)
        throw new ForbiddenError(action, 'editor_not_author');
      return;

    case 'media:write':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_write');
      return; // editor allowed for any baby they have media:write on

    case 'media:trash':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_write');
      if (!resource?.uploadedBy || resource.uploadedBy !== userId)
        throw new ForbiddenError(action, 'editor_not_uploader');
      return;

    // restore: must be own AND must have been the one who trashed it
    case 'entry:restore':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_restore');
      if (!resource?.authorId || resource.authorId !== userId)
        throw new ForbiddenError(action, 'editor_not_author');
      if (!resource?.deletedBy || resource.deletedBy !== userId)
        throw new ForbiddenError(action, 'editor_did_not_delete');
      return;

    case 'media:restore':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_restore');
      if (!resource?.uploadedBy || resource.uploadedBy !== userId)
        throw new ForbiddenError(action, 'editor_not_uploader');
      if (!resource?.deletedBy || resource.deletedBy !== userId)
        throw new ForbiddenError(action, 'editor_did_not_delete');
      return;

    // purge: owner only — already rejected above for editor/viewer
    case 'entry:purge':
    case 'media:purge':
    case 'baby:trash':
    case 'baby:restore':
    case 'baby:purge':
    case 'member:manage':
    case 'family:manage':
    case 'milestone:manage':
    case 'system:logs':
    case 'system:backup':
      throw new ForbiddenError(action, 'owner_only');

    // baby:write — editor allowed (consults baby_member_permissions)
    case 'baby:write':
      if (role === 'viewer') throw new ForbiddenError(action, 'viewer_cannot_write');
      return;

    default:
      // Exhaustiveness — should never hit
      throw new ForbiddenError(action, 'unhandled_action');
  }
}

export async function assertPermission(
  userId: string,
  action: Action,
  resource?: PermissionResource,
  opts: AssertPermissionOptions = {}
): Promise<void> {
  const dataDir = opts.dataDir
    ? resolve(opts.dataDir)
    : process.env.BABYLOOM_DATA_DIR
      ? resolve(process.env.BABYLOOM_DATA_DIR)
      : resolve(process.cwd(), 'data');

  const { db } = getDb({ dataDir });

  // 1. Membership lookup
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();

  if (!member) throw new ForbiddenError(action, 'not_family_member');

  const role = member.role as 'owner' | 'editor' | 'viewer';

  // 2. Cross-family check (always run when resource.babyId is set, regardless of bit)
  if (resource?.babyId) {
    const baby = db
      .select()
      .from(babies)
      .where(and(eq(babies.id, resource.babyId), eq(babies.familyId, member.familyId)))
      .get();
    if (!baby) throw new ForbiddenError(action, 'cross_family_baby');
  }

  // 3. Per-baby permission override — ONLY a scope gate, NEVER a grant (spec §5.3)
  //
  //   - For owner-only actions: babyPermBit() returns null; override is skipped entirely.
  //     The action falls through to checkOwnershipMatrix which enforces 'owner_only'.
  //   - For non-owner-only actions with override row present: a `0` bit DENIES the action
  //     (narrowing semantics — owner has explicitly removed the role-granted permission
  //     for this specific baby). A `1` bit lets execution fall through to the role
  //     matrix; it does NOT short-circuit allow.
  //   - No override row → fall through to role matrix (override is opt-in).
  //
  // Codex round 10 finding #1: removing the early `return` here was the entire fix.
  const bit = babyPermBit(action);
  if (bit && resource?.babyId) {
    const override = db
      .select()
      .from(babyMemberPermissions)
      .where(
        and(
          eq(babyMemberPermissions.babyId, resource.babyId),
          eq(babyMemberPermissions.familyMemberId, member.id)
        )
      )
      .get();

    if (override && override[bit] !== 1) {
      throw new ForbiddenError(action, `baby_perm_${bit}_denied`);
    }
    // Either no override (default allow per role) or override allows — fall through.
  }

  // 4. Role-based ownership matrix — final authority on allow/deny
  checkOwnershipMatrix(action, role, userId, resource);
}
```

- [ ] **Step 2: Commit (test added next task)**

```bash
git add lib/permissions/assert.ts
git commit -m "feat(P1): assertPermission with role + baby_member_permissions override + §5.4 matrix"
```

---

## Task 9: assertPermission tests — full §5.4 matrix

**Files:**
- Create: `tests/lib/permissions/assert.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function seed(dataDir: string) {
  writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: owner
  password: ownerpassword
  nickname: Owner
family:
  name: Test
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
  const { resetDbForTesting } = await import('@/lib/db/client');
  const { clearConfigCache } = await import('@/lib/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users, accounts, families, familyMembers, babies, babyMemberPermissions } =
    await import('@/lib/db/schema');
  const { hashPassword, ownerInternalEmail } = await import('@/lib/bootstrap/owner');

  const ownerUser = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];

  // Add an editor + viewer in the same family.
  // Codex round-12 finding #3 — must follow the better-auth 4-table layout
  // (spec §3.2): write to BOTH users (name/email/emailVerified/username/role)
  // AND accounts (providerId='credential', password). Plain `passwordHash` on
  // users does NOT exist in the physical schema. The seed must match what
  // bootstrapOwner does or the matrix tests fail at insert time.
  const nowMs = Date.now();
  const nowDate = new Date(nowMs);

  function seedMember(username: string, role: 'editor' | 'viewer') {
    const userId = randomUUID();
    const email = ownerInternalEmail(username);
    db.insert(users)
      .values({
        id: userId,
        name: username,
        email,
        emailVerified: true,
        username,
        role,
        createdAt: nowDate,
        updatedAt: nowDate
      })
      .run();
    // accounts row only matters if the test logs in — matrix tests don't, but
    // having it makes the seed re-usable for E2E too, and tests the dual-write
    // path the way real users will exist on disk.
    db.insert(accounts)
      .values({
        id: randomUUID(),
        userId,
        providerId: 'credential',
        accountId: email,
        password: hashPassword(`${username}-test-pw`),
        createdAt: nowDate,
        updatedAt: nowDate
      })
      .run();
    return userId;
  }

  const editorUserId = seedMember('editor', 'editor');
  const viewerUserId = seedMember('viewer', 'viewer');

  const editorMemberId = randomUUID();
  const viewerMemberId = randomUUID();
  db.insert(familyMembers)
    .values([
      {
        id: editorMemberId,
        familyId: family.id,
        userId: editorUserId,
        role: 'editor',
        joinedAt: nowMs
      },
      {
        id: viewerMemberId,
        familyId: family.id,
        userId: viewerUserId,
        role: 'viewer',
        joinedAt: nowMs
      }
    ])
    .run();

  // One active baby in the family
  const babyId = randomUUID();
  db.insert(babies)
    .values({
      id: babyId,
      familyId: family.id,
      name: 'Baby A',
      birthday: '2024-01-01',
      gender: 'girl',
      status: 'active',
      createdAt: nowMs,
      updatedAt: nowMs
    })
    .run();

  return {
    ownerId: ownerUser.id,
    editorId: editorUserId,
    viewerId: viewerUserId,
    editorMemberId,
    viewerMemberId,
    familyId: family.id,
    babyId,
    db,
    schemas: { babyMemberPermissions }
  };
}

describe('assertPermission §5.4 matrix', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-perm-'));
    ctx = await seed(dataDir);
  });

  it('owner can do anything baby-scoped', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'baby:write', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.ownerId, 'baby:purge', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
  });

  it('viewer can read but cannot write', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.viewerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.viewerId, 'baby:write', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/forbidden/);
  });

  it('editor can entry:trash own, cannot entry:trash others', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:trash',
        { babyId: ctx.babyId, authorId: ctx.editorId },
        { dataDir }
      )
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:trash',
        { babyId: ctx.babyId, authorId: ctx.ownerId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_not_author/);
  });

  it('editor cannot purge anything', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:purge',
        { babyId: ctx.babyId, authorId: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/owner_only/);
  });

  it('editor can media:restore own only AND only what they trashed', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    // own + own deletedBy → ok
    await expect(
      assertPermission(
        ctx.editorId,
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.editorId, deletedBy: ctx.editorId },
        { dataDir }
      )
    ).resolves.toBeUndefined();
    // own upload, owner deleted → rejected
    await expect(
      assertPermission(
        ctx.editorId,
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.editorId, deletedBy: ctx.ownerId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_did_not_delete/);
    // other's upload — rejected
    await expect(
      assertPermission(
        ctx.editorId,
        'media:restore',
        { babyId: ctx.babyId, uploadedBy: ctx.ownerId, deletedBy: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_not_uploader/);
  });

  it('non-family user is denied for any action', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    const strangerId = randomUUID();
    await expect(
      assertPermission(strangerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/not_family_member/);
  });

  it('cross-family babyId is denied', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    const otherBabyId = randomUUID();
    await expect(
      assertPermission(ctx.ownerId, 'baby:read', { babyId: otherBabyId }, { dataDir })
    ).rejects.toThrow(/cross_family_baby/);
  });

  it('baby_member_permissions override DENIES viewer that had role-read', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.viewerMemberId,
        canRead: 0,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    await expect(
      assertPermission(ctx.viewerId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/baby_perm_canRead_denied/);
  });

  it('baby_member_permissions override does NOT widen — editor with canDelete=1 still cannot purge (Codex round 10 finding #1)', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.editorMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    // entry:purge is owner-only — override must not unlock it
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:purge',
        { babyId: ctx.babyId, authorId: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/owner_only/);

    // media:purge is owner-only — override must not unlock it
    await expect(
      assertPermission(
        ctx.editorId,
        'media:purge',
        { babyId: ctx.babyId, uploadedBy: ctx.editorId },
        { dataDir }
      )
    ).rejects.toThrow(/owner_only/);

    // baby:trash / baby:restore / baby:purge are owner-only — override must not unlock them
    await expect(
      assertPermission(ctx.editorId, 'baby:trash', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/owner_only/);

    await expect(
      assertPermission(ctx.editorId, 'baby:purge', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });

  it('baby_member_permissions override does NOT widen — viewer with canWrite=1 still cannot write', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.viewerMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    // entry:write requires authorId==self for editor; viewer is rejected on role before that
    await expect(
      assertPermission(
        ctx.viewerId,
        'entry:write',
        { babyId: ctx.babyId, authorId: ctx.viewerId },
        { dataDir }
      )
    ).rejects.toThrow(/viewer_cannot_write/);
  });

  it('baby_member_permissions canRead=0 NARROWS editor — denies what role allowed', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.editorMemberId,
        canRead: 0,
        canWrite: 0,
        canDelete: 0
      })
      .run();

    await expect(
      assertPermission(ctx.editorId, 'baby:read', { babyId: ctx.babyId }, { dataDir })
    ).rejects.toThrow(/baby_perm_canRead_denied/);
  });

  it('baby_member_permissions canWrite=1 with present row does NOT short-circuit ownership check', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    ctx.db
      .insert(ctx.schemas.babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: ctx.editorMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();

    // entry:trash with authorId === owner (not editor) must still be denied
    // even though override has canDelete=1 — ownership matrix is final authority
    await expect(
      assertPermission(
        ctx.editorId,
        'entry:trash',
        { babyId: ctx.babyId, authorId: ctx.ownerId },
        { dataDir }
      )
    ).rejects.toThrow(/editor_not_author/);
  });

  it('member:manage is owner only', async () => {
    const { assertPermission } = await import('@/lib/permissions/assert');
    await expect(
      assertPermission(ctx.ownerId, 'member:manage', undefined, { dataDir })
    ).resolves.toBeUndefined();
    await expect(
      assertPermission(ctx.editorId, 'member:manage', undefined, { dataDir })
    ).rejects.toThrow(/owner_only/);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/lib/permissions/assert.test.ts`
Expected: 13 passing (10 base matrix + 3 round-10 regression tests).

- [ ] **Step 3: Commit**

```bash
git add tests/lib/permissions/assert.test.ts
git commit -m "test(P1): full §5.4 ownership matrix coverage + override-is-gate-not-grant regressions"
```

---

## Task 10: loadAndAssertTarget generic loader

**Why:** §5.5.1 mandates every target field (`babyId` / `entryId` / `mediaId` / `milestoneId` / `memberId` from URL or body) go through a single reflective loader. P1 only has `babies` to load, but the function must be table-agnostic so later plans drop in entries / media / milestones without re-engineering the call shape.

**Files:**
- Create: `lib/permissions/target-loaders.ts`

- [ ] **Step 1: Write `lib/permissions/target-loaders.ts`**

```typescript
import { and, eq, inArray } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { babies } from '@/lib/db/schema';
import type { Action, PermissionResource } from './actions';
import { NotFoundError, ForbiddenError } from './errors';
import { assertPermission } from './assert';
import { UUID_RE } from './responses';

export interface LoadAndAssertOptions {
  id: string;
  table: 'babies'; // expanded in P2/P3 to 'entries' | 'media' | 'milestones' | 'users'
  allowedStatuses?: string[];
  requirePermission: { userId: string; action: Action };
  toResource?: (row: any) => PermissionResource;
  dataDir?: string;
}

// Generic loader. Returns the DB row on success, throws NotFoundError on any
// shape/existence/status/cross-scope failure. ForbiddenError from
// assertPermission also escapes — the caller is responsible for translating
// both to a unified 404 (§5.6).
export async function loadAndAssertTarget<R = unknown>(
  opts: LoadAndAssertOptions
): Promise<R> {
  if (!UUID_RE.test(opts.id)) throw new NotFoundError(opts.table);

  const dataDir = opts.dataDir
    ? resolve(opts.dataDir)
    : process.env.BABYLOOM_DATA_DIR
      ? resolve(process.env.BABYLOOM_DATA_DIR)
      : resolve(process.cwd(), 'data');

  const { db } = getDb({ dataDir });

  let row: any;
  switch (opts.table) {
    case 'babies':
      row = db.select().from(babies).where(eq(babies.id, opts.id)).get();
      break;
    default:
      throw new Error(`unsupported table: ${opts.table}`);
  }

  if (!row) throw new NotFoundError(opts.table);

  if (opts.allowedStatuses && !opts.allowedStatuses.includes(row.status)) {
    throw new NotFoundError(opts.table);
  }

  const resource = opts.toResource ? opts.toResource(row) : { babyId: row.id };
  await assertPermission(opts.requirePermission.userId, opts.requirePermission.action, resource, {
    dataDir
  });

  return row as R;
}
```

- [ ] **Step 2: Commit (tests next task)**

```bash
git add lib/permissions/target-loaders.ts
git commit -m "feat(P1): loadAndAssertTarget generic loader (babies table only in P1)"
```

---

## Task 11: loadAndAssertTarget tests

**Files:**
- Create: `tests/lib/permissions/target-loaders.test.ts`

- [ ] **Step 1: Write the tests** (reuses the `seed` helper concept inline)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

async function seed(dataDir: string) {
  writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: owner
  password: ownerpassword
  nickname: Owner
family:
  name: Test
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
  const { resetDbForTesting } = await import('@/lib/db/client');
  const { clearConfigCache } = await import('@/lib/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users, families, babies } = await import('@/lib/db/schema');
  const ownerUser = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];

  const now = Date.now();
  const activeBabyId = randomUUID();
  const trashedBabyId = randomUUID();

  db.insert(babies)
    .values([
      {
        id: activeBabyId,
        familyId: family.id,
        name: 'A',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: now,
        updatedAt: now
      },
      {
        id: trashedBabyId,
        familyId: family.id,
        name: 'T',
        birthday: '2024-01-01',
        gender: 'boy',
        status: 'trashed',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        deletedBy: ownerUser.id
      }
    ])
    .run();

  return { ownerId: ownerUser.id, activeBabyId, trashedBabyId };
}

describe('loadAndAssertTarget — babies', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-target-'));
    ctx = await seed(dataDir);
  });

  it('returns the active baby for the owner', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.activeBabyId,
      table: 'babies',
      allowedStatuses: ['active'],
      requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
      dataDir
    });
    expect(row.id).toBe(ctx.activeBabyId);
  });

  it('NotFoundError on non-UUID id', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: 'not-a-uuid',
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('NotFoundError on unknown id', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: randomUUID(),
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('NotFoundError on trashed baby when allowedStatuses=[active]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.trashedBabyId,
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('returns trashed baby when allowedStatuses=[trashed]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.trashedBabyId,
      table: 'babies',
      allowedStatuses: ['trashed'],
      requirePermission: { userId: ctx.ownerId, action: 'baby:restore' },
      dataDir
    });
    expect(row.id).toBe(ctx.trashedBabyId);
  });

  it('ForbiddenError from assertPermission propagates (cross-user stranger)', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.activeBabyId,
        table: 'babies',
        allowedStatuses: ['active'],
        requirePermission: { userId: randomUUID(), action: 'baby:read' },
        dataDir
      })
    ).rejects.toThrow(/forbidden/);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/lib/permissions/target-loaders.test.ts`
Expected: 6 passing.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/permissions/target-loaders.test.ts
git commit -m "test(P1): loadAndAssertTarget edge cases for babies"
```

---

## Task 12: withAuthorizedResource — API route template

**Files:**
- Create: `lib/permissions/route-template.ts`

> **Codex round-12 finding #1 fix**: the wrapper now owns the §5.7 status gate. `allowedStatuses` is **required** (not optional) so "I forgot" becomes a TypeScript error. The wrapper consults `getStatus(row)` after the loader returns and BEFORE `assertPermission`, returning a unified 404 if the row's status is not in the allowed set. Handlers never see a trashed/purged row.

- [ ] **Step 1: Write `lib/permissions/route-template.ts`**

```typescript
import { type NextRequest } from 'next/server';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';
import { jsonNotFound, jsonUnauthorized, UUID_RE } from './responses';
import { getSessionUserId } from './session';
import { assertPermission } from './assert';

// `allowedStatuses` is REQUIRED — not optional. A route that genuinely has no
// status column on its target table should pass a tuple containing the only
// valid value (e.g. `['ok']`) explicitly, after pointing `getStatus` to a
// constant. This forces every route author to make a status decision rather
// than accidentally exposing trashed rows.
export interface WithAuthorizedResourceOpts<R> {
  action: Action;
  loader: (id: string) => Promise<R | null>;
  getStatus: (row: R) => string;
  allowedStatuses: readonly string[];
  toResource: (row: R) => PermissionResource;
}

// Wraps a Next.js App Router handler. Every protected /api route MUST use this
// (enforced by ESLint rule babyloom/api-route-must-assert).
//
// Pipeline (spec §5.7):
//   1. UUID shape       → 404 if malformed
//   2. Session          → 401 if missing (the only non-404 negative)
//   3. Load by id       → 404 if no row
//   4. Status gate      → 404 if row.status not in allowedStatuses    (§5.6)
//   5. assertPermission → ForbiddenError → 404 (§5.6)
//   6. Hand off trusted row to handler
export function withAuthorizedResource<R>(opts: WithAuthorizedResourceOpts<R>) {
  return function wrap(
    handler: (req: NextRequest, ctx: { params: { id: string } }, row: R) => Promise<Response>
  ) {
    return async function route(
      req: NextRequest,
      ctx: { params: Promise<{ id: string }> | { id: string } }
    ): Promise<Response> {
      try {
        const params = await Promise.resolve(ctx.params);
        if (!UUID_RE.test(params.id)) return jsonNotFound();

        let userId: string;
        try {
          userId = await getSessionUserId(req);
        } catch (e) {
          if (e instanceof UnauthorizedError) return jsonUnauthorized();
          throw e;
        }

        const row = await opts.loader(params.id);
        if (!row) return jsonNotFound();

        // STATUS GATE (Codex round-12 finding #1): collapses status mismatch
        // to unified 404 before authorization runs. Without this, a route
        // handler that forgets `if (row.status !== 'active') return 404` will
        // happily serve trashed rows after authorization passes — a
        // resource-existence leak the spec §5.6 forbids.
        const status = opts.getStatus(row);
        if (!opts.allowedStatuses.includes(status)) return jsonNotFound();

        await assertPermission(userId, opts.action, opts.toResource(row));

        return await handler(req, { params: params }, row);
      } catch (e) {
        if (e instanceof ForbiddenError || e instanceof NotFoundError) return jsonNotFound();
        throw e;
      }
    };
  };
}
```

- [ ] **Step 2: Commit (tests next task)**

```bash
git add lib/permissions/route-template.ts
git commit -m "feat(P1): withAuthorizedResource HOF for protected API routes"
```

---

## Task 13: withAuthorizedResource tests

**Files:**
- Create: `tests/lib/permissions/route-template.test.ts`

- [ ] **Step 1: Write the tests** (no full Next runtime — invoke the wrapped handler directly)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function seed(dataDir: string) {
  writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: owner
  password: ownerpassword
  nickname: Owner
family:
  name: Test
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
  const { resetDbForTesting } = await import('@/lib/db/client');
  const { clearConfigCache } = await import('@/lib/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
  await bootstrapOwner({ dataDir });
  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users, families, babies } = await import('@/lib/db/schema');
  const owner = db.select().from(users).all()[0];
  const fam = db.select().from(families).all()[0];
  const babyId = randomUUID();
  db.insert(babies)
    .values({
      id: babyId,
      familyId: fam.id,
      name: 'A',
      birthday: '2024-01-01',
      gender: 'girl',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    .run();
  return { ownerId: owner.id, babyId };
}

function mockReq(): any {
  return { headers: new Headers() };
}

describe('withAuthorizedResource', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-route-'));
    ctx = await seed(dataDir);
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  async function buildWrapped(
    action: 'baby:read',
    allowedStatuses: readonly string[] = ['active']
  ) {
    const { withAuthorizedResource } = await import('@/lib/permissions/route-template');
    const { getDb } = await import('@/lib/db/client');
    const { babies } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });

    return withAuthorizedResource({
      action,
      loader: async (id: string) => db.select().from(babies).where(eq(babies.id, id)).get() ?? null,
      getStatus: (row: any) => row.status,
      allowedStatuses,
      toResource: (row: any) => ({ babyId: row.id })
    })(async (req, _ctx, row: any) => {
      return new Response(JSON.stringify({ ok: true, id: row.id }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
  }

  it('returns 404 for non-UUID id', async () => {
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: { id: 'bad-id' } });
    expect(res.status).toBe(404);
  });

  it('returns 401 when no session', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => {
        const { UnauthorizedError } = await import('@/lib/permissions/errors');
        throw new UnauthorizedError();
      }
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: { id: ctx.babyId } });
    expect(res.status).toBe(401);
    vi.doUnmock('@/lib/permissions/session');
  });

  it('returns 200 when owner reads own baby', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: { id: ctx.babyId } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ctx.babyId);
    vi.doUnmock('@/lib/permissions/session');
  });

  it('returns 404 (not 403) when permission denied', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => randomUUID() // stranger
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: { id: ctx.babyId } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
    vi.doUnmock('@/lib/permissions/session');
  });

  it('returns 404 when row missing from DB', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildWrapped('baby:read');
    const res = await route(mockReq(), { params: { id: randomUUID() } });
    expect(res.status).toBe(404);
    vi.doUnmock('@/lib/permissions/session');
  });

  it('Codex round-12: status gate fires BEFORE assertPermission — trashed row returns unified 404 even for owner', async () => {
    // Soft-delete the baby
    const { getDb } = await import('@/lib/db/client');
    const { babies } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });
    db.update(babies)
      .set({ status: 'trashed', deletedAt: Date.now(), deletedBy: ctx.ownerId })
      .where(eq(babies.id, ctx.babyId))
      .run();

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const route = await buildWrapped('baby:read', ['active']);
    const res = await route(mockReq(), { params: { id: ctx.babyId } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
    vi.doUnmock('@/lib/permissions/session');
  });

  it('Codex round-12: when allowedStatuses includes trashed, the same row IS served', async () => {
    const { getDb } = await import('@/lib/db/client');
    const { babies } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });
    db.update(babies)
      .set({ status: 'trashed', deletedAt: Date.now(), deletedBy: ctx.ownerId })
      .where(eq(babies.id, ctx.babyId))
      .run();

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    // Owner restore/trash UI loads the trashed baby explicitly
    const route = await buildWrapped('baby:read', ['trashed']);
    const res = await route(mockReq(), { params: { id: ctx.babyId } });
    expect(res.status).toBe(200);
    vi.doUnmock('@/lib/permissions/session');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/lib/permissions/route-template.test.ts`
Expected: 7 passing (5 base + 2 round-12 status-gate regressions).

- [ ] **Step 3: Commit**

```bash
git add tests/lib/permissions/route-template.test.ts
git commit -m "test(P1): withAuthorizedResource template — 401 / 404 / 200 + status-gate"
```

---

## Task 14: withPermission — server action wrapper

**Why:** Server actions can't reuse `withAuthorizedResource` (they don't have `Request` / URL params). They get their own HOF that takes a `resolveResource(formData)` callback.

**Files:**
- Create: `lib/permissions/server-action.ts`

- [ ] **Step 1: Write `lib/permissions/server-action.ts`**

```typescript
import { headers } from 'next/headers';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';
import { assertPermission } from './assert';
import { getSessionUserIdFromHeaders } from './session';

export interface WithPermissionOpts<Args extends any[]> {
  action: Action;
  resolveResource: (...args: Args) => Promise<PermissionResource | undefined>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: 'unauthorized' | 'not_found' };

// Wraps a server action with auth + permission. The wrapped handler receives
// the trusted userId as its first argument; it must NEVER read userId/role
// from form data.
export function withPermission<Args extends any[], T>(
  opts: WithPermissionOpts<Args>,
  handler: (userId: string, ...args: Args) => Promise<T>
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args: Args) => {
    try {
      const userId = await getSessionUserIdFromHeaders(headers());
      const resource = await opts.resolveResource(...args);
      await assertPermission(userId, opts.action, resource);
      const data = await handler(userId, ...args);
      return { ok: true, data };
    } catch (e) {
      if (e instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
      if (e instanceof ForbiddenError || e instanceof NotFoundError)
        return { ok: false, error: 'not_found' };
      throw e;
    }
  };
}
```

- [ ] **Step 2: Commit (tests next task)**

```bash
git add lib/permissions/server-action.ts
git commit -m "feat(P1): withPermission HOF for server actions"
```

---

## Task 15: withPermission tests

**Files:**
- Create: `tests/lib/permissions/server-action.test.ts`

- [ ] **Step 1: Write the test (mock next/headers + session)**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function seed(dataDir: string) {
  writeFileSync(join(dataDir, 'config.yaml'), `
owner:
  username: owner
  password: ownerpassword
  nickname: Owner
family:
  name: Test
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
`);
  const { resetDbForTesting } = await import('@/lib/db/client');
  const { clearConfigCache } = await import('@/lib/config/load');
  resetDbForTesting();
  clearConfigCache();
  const { runMigrations } = await import('@/lib/db/migrate');
  runMigrations(dataDir);
  const { bootstrapOwner } = await import('@/lib/bootstrap/owner');
  await bootstrapOwner({ dataDir });
  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users } = await import('@/lib/db/schema');
  return { ownerId: db.select().from(users).all()[0].id };
}

vi.mock('next/headers', () => ({
  headers: async () => new Headers()
}));

describe('withPermission server action wrapper', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-action-'));
    ctx = await seed(dataDir);
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  it('returns ok with trusted userId when authorized', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => ctx.ownerId
    }));
    const { withPermission } = await import('@/lib/permissions/server-action');
    const wrapped = withPermission(
      { action: 'member:manage', resolveResource: async () => undefined },
      async (userId, payload: { msg: string }) => ({ userId, payload })
    );
    const res = await wrapped({ msg: 'hi' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.userId).toBe(ctx.ownerId);
      expect(res.data.payload.msg).toBe('hi');
    }
    vi.doUnmock('@/lib/permissions/session');
  });

  it('returns unauthorized when no session', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => {
        const { UnauthorizedError } = await import('@/lib/permissions/errors');
        throw new UnauthorizedError();
      }
    }));
    const { withPermission } = await import('@/lib/permissions/server-action');
    const wrapped = withPermission(
      { action: 'member:manage', resolveResource: async () => undefined },
      async () => 'never'
    );
    const res = await wrapped();
    expect(res).toEqual({ ok: false, error: 'unauthorized' });
    vi.doUnmock('@/lib/permissions/session');
  });

  it('returns not_found (not 403) when forbidden', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => randomUUID() // stranger
    }));
    const { withPermission } = await import('@/lib/permissions/server-action');
    const wrapped = withPermission(
      { action: 'member:manage', resolveResource: async () => undefined },
      async () => 'never'
    );
    const res = await wrapped();
    expect(res).toEqual({ ok: false, error: 'not_found' });
    vi.doUnmock('@/lib/permissions/session');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/lib/permissions/server-action.test.ts`
Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/permissions/server-action.test.ts
git commit -m "test(P1): withPermission — ok / unauthorized / forbidden→not_found"
```

---

## Task 16: ESLint custom rule — api-route-must-assert (template-only, flat config)

**Why:** Spec §5.5 / §5.7 says every `app/api/**/route.ts` **must** go through the `withAuthorizedResource` route template — that's the only entry point that guarantees the §5.6 unified 404 + status gate + DB-authoritative loader order. A bare `export async function GET()` returning protected data must trip CI.

**Codex round-11 finding #2 fix**: an earlier draft also accepted direct `assertPermission(...)` calls in route bodies. That opened a control-flow bypass — `if (false) await assertPermission(...)`, post-return dead code, or a never-set debug header could trick the lint AST walker. **The fix is to remove that path entirely**: routes have exactly one allowed shape — `export const METHOD = withAuthorizedResource(...)(...)` — and the rule rejects everything else. Direct `assertPermission` calls remain legal inside server actions / internal lib code; they are simply not allowed as the auth gate for an `app/api/**/route.ts` export.

This is also philosophically aligned with §5.7 "所有 `/api/media/*` 和受保护 API Route **必须**套此模板".

**Codex round-11 finding #1 fix**: ESLint 9 dropped legacy `.eslintrc.*` lookup by default. Use the flat-config format (`eslint.config.mjs`) so the rule actually loads under `pnpm lint`.

**Rule algorithm**:

For each file matching `/app/api/**/route.{ts,tsx,js,jsx}` (minus allowlist `auth/[...all]` and `health`):

1. Visit every `ExportNamedDeclaration` whose declared name is in `{GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS}`.
2. The export must be a **VariableDeclarator** whose `init` is a `CallExpression` and whose leftmost callee identifier is `withAuthorizedResource`. Pattern: `withAuthorizedResource(...)(...)` (the outer call returns a wrapped handler).
3. Any other shape (FunctionDeclaration, ArrowFunctionExpression directly assigned, non-`withAuthorizedResource` initializer) → report error.

Comments, unused imports, string literals, control-flow tricks (`if (false)`, dead code after `return`, conditional headers) are all ignored by construction — they live inside the handler body that the template wraps, but the **export itself** must be the wrapper call.

Trade-off: developers can no longer write `export async function GET() { await assertPermission(...); ... }` in a route. They must wrap via `withAuthorizedResource`. Accepted — that's the spec's stated rule and the only one that's mechanically enforceable.

**Files:**
- Create: `eslint-rules/package.json`, `eslint-rules/index.js`, `eslint-rules/api-route-must-assert.js`
- Create: `.eslintrc.cjs`

- [ ] **Step 1: Write the local rule package**

`eslint-rules/package.json`:

```json
{
  "name": "eslint-plugin-babyloom",
  "version": "0.0.0",
  "private": true,
  "main": "index.js"
}
```

`eslint-rules/index.js`:

```javascript
'use strict';

module.exports = {
  rules: {
    'api-route-must-assert': require('./api-route-must-assert')
  }
};
```

`eslint-rules/api-route-must-assert.js`:

```javascript
'use strict';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

// Walk a CallExpression's callee chain to find the leftmost Identifier.
//   withAuthorizedResource({...})(handler)
//     → CallExpression( callee: CallExpression( callee: Identifier 'withAuthorizedResource' ) )
function leftmostCalleeName(node) {
  let current = node;
  while (current && current.type === 'CallExpression') {
    current = current.callee;
  }
  return current && current.type === 'Identifier' ? current.name : null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every app/api/**/route.ts HTTP-method export must be `withAuthorizedResource(...)(handler)` — no other shape allowed.'
    },
    messages: {
      notWrapped:
        'API route export "{{name}}" must be exported as `export const {{name}} = withAuthorizedResource(...)(handler)`. Direct function exports or other initializers are forbidden (spec §5.7). See docs/superpowers/specs/...#section-5-7.'
    },
    schema: []
  },
  create(context) {
    const filename = context.getFilename();
    const isApiRoute = /\/app\/api\/.*\/route\.(ts|tsx|js|jsx)$/.test(filename);
    if (!isApiRoute) return {};

    // Allowlist: better-auth's own catch-all, and the public health endpoint
    if (/\/app\/api\/auth\/\[\.\.\.all\]\/route\.(ts|tsx|js|jsx)$/.test(filename)) return {};
    if (/\/app\/api\/health\/route\.(ts|tsx|js|jsx)$/.test(filename)) return {};

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;

        // ─── Case A: `export specifier` form (Codex round-12 finding #2) ───
        // Covers `const GET = ...; export { GET };` and re-exports.
        // This shape has decl===null and specifiers!==[]. Reject any HTTP
        // method name appearing as an exported specifier — the only legal
        // route shape is a direct `export const METHOD = wrapper(...)(...)`.
        if (!decl) {
          for (const spec of node.specifiers ?? []) {
            // ExportSpecifier: { type, local: Identifier, exported: Identifier }
            const exportedName =
              spec?.exported?.type === 'Identifier' ? spec.exported.name : null;
            if (exportedName && HTTP_METHODS.has(exportedName)) {
              context.report({ node: spec, messageId: 'notWrapped', data: { name: exportedName } });
            }
          }
          return;
        }

        // ─── Case B: `export async function GET(){}` ──────────────────────
        if (decl.type === 'FunctionDeclaration') {
          const name = decl.id?.name;
          if (name && HTTP_METHODS.has(name)) {
            context.report({ node, messageId: 'notWrapped', data: { name } });
          }
          return;
        }

        // ─── Case C: `export const GET = withAuthorizedResource(...)(...)` ─
        if (decl.type !== 'VariableDeclaration') return;

        for (const d of decl.declarations) {
          const name = d.id?.type === 'Identifier' ? d.id.name : null;
          if (!name || !HTTP_METHODS.has(name)) continue;

          const init = d.init;
          const ok =
            init &&
            init.type === 'CallExpression' &&
            leftmostCalleeName(init) === 'withAuthorizedResource';

          if (!ok) {
            context.report({ node: d, messageId: 'notWrapped', data: { name } });
          }
        }
      },

      // Belt-and-suspenders: also reject `export default` for HTTP methods
      // (Next.js doesn't accept these for route methods, but defense in depth).
      ExportDefaultDeclaration(node) {
        // Default exports cannot be HTTP method handlers in App Router; ignore
        // to avoid false positives in non-route files matching the path glob.
        // (left intentionally empty — this branch documents the decision)
      }
    };
  }
};
```

**Why no body/reachability analysis**: Codex round 11 noted that any body-scan rule can be defeated with `if (false)` / post-return code / never-set header conditions, and that a full control-flow analysis is out of scope for an ESLint rule. By rejecting **everything except** the wrapper-call shape, the rule sidesteps the entire class of bypass — there's no body for the linter to misread. The wrapper itself (Task 12 `withAuthorizedResource`) is the trusted unit; its contract is covered by Task 13 unit tests.

- [ ] **Step 2: Write `eslint.config.mjs`** (ESLint 9 flat config — `.eslintrc.*` is no longer loaded by default)

```javascript
import tseslint from '@typescript-eslint/parser';
import babyloom from 'eslint-plugin-babyloom';

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'lib/db/migrations/**', 'eslint-rules/**', 'test-data/**', 'test-results/**', 'playwright-report/**']
  },
  {
    files: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      babyloom
    },
    rules: {
      'babyloom/api-route-must-assert': 'error'
    }
  }
];
```

> If the file `.eslintrc.cjs` already exists from any earlier attempt, **delete it** — ESLint 9 will warn about it and may behave unpredictably if both exist.

- [ ] **Step 3: Wire the local plugin into the dependency graph**

The simplest path is a workspace-style file dependency. Add to `package.json` `devDependencies`:

```json
    "eslint": "^9.13.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint-plugin-babyloom": "file:./eslint-rules"
```

Then run: `pnpm install`
Expected: `eslint-plugin-babyloom` linked from local path.

- [ ] **Step 4: Add `lint` script to `package.json`**

Modify `scripts`:

```json
    "lint": "eslint \"app/**/*.{ts,tsx}\" \"lib/**/*.{ts,tsx}\""
```

(Replaces any prior `next lint`.)

- [ ] **Step 5: Verify the rule actually loaded (Codex round-11 finding #1 guard)**

Before testing fixtures, confirm ESLint 9 picked up the flat config AND the custom rule:

```bash
pnpm lint --print-config app/api/babies/\[id\]/route.ts | grep -E '"babyloom/api-route-must-assert"\s*:\s*\[?\s*"?error"?' && echo "OK: rule installed" || echo "FAIL: rule NOT loaded"
```

Expected: `OK: rule installed`. If `FAIL`, the flat config didn't register the plugin — fix `eslint.config.mjs` before continuing.

- [ ] **Step 6: Smoke test against 7 fixtures (5 must fire, 1 must pass, 1 must fire for unreachable bypass)**

Codex round-10/11 findings — every shape that isn't `withAuthorizedResource(...)(...)` must be rejected, including the control-flow bypass attempts (`if (false)`, post-return) that an earlier draft allowed by accepting bare `assertPermission` calls.

```bash
mkdir -p app/api/_rule_smoke

run_fixture() {
  local name="$1" expect="$2"  # expect = "fire" or "pass"
  pnpm lint app/api/_rule_smoke/route.ts > /dev/null 2>&1
  local rc=$?
  if [ "$expect" = "fire" ] && [ $rc -ne 0 ]; then echo "OK: $name caught"
  elif [ "$expect" = "pass" ] && [ $rc -eq 0 ]; then echo "OK: $name passed"
  else echo "FAIL: $name (expected $expect, lint rc=$rc)"
  fi
}

# Fixture 1: bare function export — must fire
cat > app/api/_rule_smoke/route.ts <<'EOF'
export async function GET() { return new Response('secret'); }
EOF
run_fixture "1 bare-fn" fire

# Fixture 2: comment-only reference — must fire
cat > app/api/_rule_smoke/route.ts <<'EOF'
// withAuthorizedResource later — TODO
// assertPermission needs to go here
export async function GET() { return new Response('secret'); }
EOF
run_fixture "2 comment-bypass" fire

# Fixture 3: unused imports — must fire
cat > app/api/_rule_smoke/route.ts <<'EOF'
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { assertPermission } from '@/lib/permissions/assert';
export async function GET() { return new Response('secret'); }
EOF
run_fixture "3 unused-imports" fire

# Fixture 4: direct assertPermission inside function body — must fire (round-11 finding #2)
# This shape is forbidden even with a real call; routes MUST use the wrapper.
cat > app/api/_rule_smoke/route.ts <<'EOF'
import { assertPermission } from '@/lib/permissions/assert';
export async function GET() {
  await assertPermission('user-id', 'baby:read');
  return new Response('secret');
}
EOF
run_fixture "4 direct-call-bare-fn" fire

# Fixture 5: arrow assigned to const, not wrapper — must fire (covers control-flow bypass attempts)
# A reachability-aware rule would have to chase `if (false)` / post-return etc.
# Template-only short-circuits the whole class.
cat > app/api/_rule_smoke/route.ts <<'EOF'
import { assertPermission } from '@/lib/permissions/assert';
export const GET = async () => {
  if (false) await assertPermission('user-id', 'baby:read');
  return new Response('secret');
};
EOF
run_fixture "5 arrow-unreachable-call" fire

# Fixture 6: const-assigned non-wrapper call — must fire
cat > app/api/_rule_smoke/route.ts <<'EOF'
import { someOtherWrapper } from '@/lib/permissions/route-template';
export const GET = someOtherWrapper({ action: 'baby:read' })(async () => new Response('ok'));
EOF
run_fixture "6 wrong-wrapper" fire

# Fixture 7 (positive): real template use — must pass
cat > app/api/_rule_smoke/route.ts <<'EOF'
import { withAuthorizedResource } from '@/lib/permissions/route-template';
export const GET = withAuthorizedResource({
  action: 'baby:read',
  loader: async () => null,
  getStatus: () => 'active',
  allowedStatuses: ['active'],
  toResource: () => ({})
})(async () => new Response('ok'));
EOF
run_fixture "7 template-positive" pass

# Fixture 8: const + export specifier (Codex round-12 finding #2)
# Without specifier handling, the previous rule version returned early on
# decl===null and let this through.
cat > app/api/_rule_smoke/route.ts <<'EOF'
const GET = async () => new Response('secret');
export { GET };
EOF
run_fixture "8 specifier-bypass" fire

# Fixture 9: rename via specifier — `export { localName as GET }`
cat > app/api/_rule_smoke/route.ts <<'EOF'
const handler = async () => new Response('secret');
export { handler as GET };
EOF
run_fixture "9 specifier-rename-bypass" fire

rm -rf app/api/_rule_smoke
```

Expected output (all 9 lines):
```
OK: 1 bare-fn caught
OK: 2 comment-bypass caught
OK: 3 unused-imports caught
OK: 4 direct-call-bare-fn caught
OK: 5 arrow-unreachable-call caught
OK: 6 wrong-wrapper caught
OK: 7 template-positive passed
OK: 8 specifier-bypass caught
OK: 9 specifier-rename-bypass caught
```

If any line starts with `FAIL`, the rule is broken — fix it before continuing.

- [ ] **Step 7: Commit**

```bash
git add eslint-rules/ eslint.config.mjs package.json pnpm-lock.yaml
# Also delete any legacy config that may have been left over
git rm -f .eslintrc.cjs 2>/dev/null || true
git commit -m "feat(P1): ESLint flat config + babyloom/api-route-must-assert (template-only)"
```

---

## Task 17: Sample protected route — GET /api/babies/[id]

**Why:** End-to-end smoke that the whole stack works. Also gives P2 a working precedent to copy.

**Files:**
- Create: `app/api/babies/[id]/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { babies } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadBaby(id: string) {
  const { db } = getDb({ dataDir });
  return db.select().from(babies).where(eq(babies.id, id)).get() ?? null;
}

export const GET = withAuthorizedResource({
  action: 'baby:read',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'], // trashed/purged collapse to 404 in the wrapper
  toResource: (row) => ({ babyId: row.id })
})(async (_req, _ctx, row) => {
  // No defensive status check here — the wrapper guarantees row.status === 'active'.
  return Response.json({
    id: row.id,
    name: row.name,
    birthday: row.birthday,
    gender: row.gender,
    avatarUrl: row.avatarUrl
  });
});
```

- [ ] **Step 2: Lint to make sure the rule accepts it**

Run: `pnpm lint app/api/babies/\[id\]/route.ts`
Expected: 0 errors.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/babies/
git commit -m "feat(P1): sample GET /api/babies/[id] using the route template"
```

---

## Task 18: E2E — owner reads / non-member 404 / unauth 401

**Files:**
- Create: `tests/e2e/permissions.spec.ts`

- [ ] **Step 1: Extend the e2e global-setup config to also create a baby + a second-family stranger**

Update `playwright.config.ts` global-setup (or wherever P0 seeds the e2e DB) so that **after** owner bootstrap runs, the test fixtures also include:

- one baby in the owner's family (record its ID somewhere the test can read it)
- an `editor` user not added to any family (i.e. a stranger)

The simplest mechanism: have a `tests/e2e/fixtures.ts` that, after the playwright webserver is up, hits a `tests/e2e/_fixtures_seed.ts` helper that uses the dev server's exported helpers. Concrete approach below.

Create `tests/e2e/fixtures.ts`:

> **Codex round-11 finding #3 fix**: the stranger account MUST be seeded into both `users` AND `accounts.password` (providerId='credential') — the same physical layout `bootstrapOwner` uses (spec §3.2). An earlier draft wrote `nickname`/`passwordHash` directly into `users`, which doesn't exist in the better-auth 4-table schema and would either typecheck-fail or leave the stranger unable to log in (making the 404-vs-cross-family E2E vacuous).

```typescript
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export async function seedE2eExtras() {
  const dataDir = resolve(process.cwd(), 'test-data/e2e');
  process.env.BABYLOOM_DATA_DIR = dataDir;

  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users, accounts, families, babies } = await import('@/lib/db/schema');
  const { hashPassword, ownerInternalEmail } = await import('@/lib/bootstrap/owner');

  const owner = db.select().from(users).all().find((u: any) => u.role === 'owner');
  if (!owner) throw new Error('owner not bootstrapped — run global-setup first');
  const family = db.select().from(families).all()[0];

  // Ensure one active baby in the owner's family for the cross-family 404 test
  let baby = db.select().from(babies).all()[0];
  if (!baby) {
    const id = randomUUID();
    db.insert(babies)
      .values({
        id,
        familyId: family.id,
        name: 'E2E Baby',
        birthday: '2024-01-01',
        gender: 'girl',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();
    baby = db.select().from(babies).all()[0];
  }

  // A "stranger" user account that is NOT in any family_members row —
  // used to verify the 404 (not 403, not 200) cross-tenant isolation path.
  // Must follow the SAME physical layout as bootstrapOwner (spec §3.2):
  //   users  : id, name, email, emailVerified, username, role, timestamps
  //   accounts: providerId='credential', accountId=email, password=scrypt hash
  const strangerUsername = 'stranger';
  const strangerPassword = 'strangerpw1';
  const strangerEmail = ownerInternalEmail(strangerUsername);

  let stranger = db.select().from(users).all().find((u: any) => u.username === strangerUsername);
  if (!stranger) {
    const id = randomUUID();
    const now = new Date();
    db.insert(users)
      .values({
        id,
        name: 'Stranger',
        email: strangerEmail,
        emailVerified: true,
        username: strangerUsername,
        role: 'editor', // role on users is informational; family_members is authoritative
        createdAt: now,
        updatedAt: now
      })
      .run();
    db.insert(accounts)
      .values({
        id: randomUUID(),
        userId: id,
        providerId: 'credential',
        accountId: strangerEmail,
        password: hashPassword(strangerPassword),
        createdAt: now,
        updatedAt: now
      })
      .run();
    stranger = db.select().from(users).all().find((u: any) => u.username === strangerUsername);
  }

  // Stranger logs in via email (better-auth sign-in-email path), not username.
  // Test code should use { email: strangerEmail, password: strangerPassword }.
  return {
    babyId: baby.id,
    strangerCreds: { email: strangerEmail, password: strangerPassword }
  };
}
```

- [ ] **Step 2: Write `tests/e2e/permissions.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { seedE2eExtras } from './fixtures';

test.describe('GET /api/babies/[id] permission gating', () => {
  let babyId: string;
  let strangerCreds: { email: string; password: string };

  test.beforeAll(async () => {
    const seed = await seedE2eExtras();
    babyId = seed.babyId;
    strangerCreds = seed.strangerCreds;
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.get(`/api/babies/${babyId}`);
    expect(res.status()).toBe(401);
  });

  test('owner authenticated → 200 with baby payload', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.get(`/api/babies/${babyId}`, {
      headers: { cookie: cookieHeader }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(babyId);
    expect(body.name).toBe('E2E Baby');
  });

  test('non-family user → 404 (not 403)', async ({ page, request }) => {
    // Stranger logs in via email — username login is the owner's own flow only
    // (P0 login form was username-based for owner-only ergonomics; stranger
    // uses better-auth's email sign-in endpoint directly, OR if the login form
    // accepts both, this still works.)
    //
    // If the login form only accepts username, swap to a direct API call:
    //   await request.post('/api/auth/sign-in/email', { data: strangerCreds });
    //   const cookies = await request.storageState();
    //
    // Reference implementation assumes the login form supports email; if not,
    // adapt to better-auth's sign-in-email endpoint.
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: strangerCreds
    });
    expect(signIn.status()).toBeLessThan(400);
    // Extract cookies from the sign-in response
    const setCookies = signIn.headers()['set-cookie'] ?? '';
    const cookieHeader = setCookies.split(/,(?=\s*\w+=)/).map((c) => c.split(';')[0].trim()).join('; ');

    const res = await request.get(`/api/babies/${babyId}`, {
      headers: { cookie: cookieHeader }
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  test('invalid-shape id → 404', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.get('/api/babies/not-a-uuid', {
      headers: { cookie: cookieHeader }
    });
    expect(res.status()).toBe(404);
  });

  test('unknown UUID → 404', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.get('/api/babies/00000000-0000-0000-0000-000000000000', {
      headers: { cookie: cookieHeader }
    });
    expect(res.status()).toBe(404);
  });
});
```

> Note: the login form selectors above assume the spec-aligned login uses `name="username"` (not `name="email"`). The P0 repair landed this change.

- [ ] **Step 3: Restore plan-spec'd globalSetup pattern**

The P0 implementation drifted to a module-level setup inside `playwright.config.ts`. Restore the plan-designed pattern:

Edit `playwright.config.ts` and replace the module-level `existsSync` guard with a proper `globalSetup`:

```typescript
import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const e2eDir = resolve(process.cwd(), 'test-data/e2e');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: `BABYLOOM_DATA_DIR=${e2eDir} pnpm dev`,
    url: 'http://localhost:3000/api/health',
    timeout: 60_000,
    reuseExistingServer: false
  }
});
```

Create `tests/e2e/global-setup.ts`:

```typescript
import { rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function globalSetup() {
  const dir = resolve(process.cwd(), 'test-data/e2e');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/config.yaml`,
    `owner:
  username: e2eowner
  password: e2epassword
  nickname: E2E Owner
family:
  name: E2E Family
app:
  baseUrl: http://localhost:3000
  timezone: Asia/Shanghai
  secret: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd
log:
  level: warn
`,
    'utf-8'
  );
  chmodSync(`${dir}/config.yaml`, 0o600);
}
```

- [ ] **Step 4: Run E2E**

Run: `pnpm test:e2e`
Expected: 4 (P0 login) + 5 (P1 permissions) = 9 passing.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test(P1): E2E permission gating + restore plan-spec globalSetup"
```

---

## Task 19: Update P0 ESLint findings

**Why:** Running `pnpm lint` against the existing app might surface other paths that don't yet pass the rule (e.g. an early `app/api/something/route.ts` that ships without auth). Sweep.

- [ ] **Step 1: Run lint over the full tree**

Run: `pnpm lint`
Expected: 0 errors. If any existing route fails the rule, decide per-route whether to add it to the allowlist (`api/auth/...all`, `api/health`) or to wrap it with `withAuthorizedResource`.

- [ ] **Step 2: If any fix was needed, commit it**

```bash
git add -A
git commit -m "fix(P1): bring legacy routes under api-route-must-assert"
```

(Skip if no changes.)

---

## P1 Acceptance Checklist

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` — at least 37 passing (P0's 14 + P1's: 13 matrix [incl 3 round-10 regressions] + 6 target-loaders + 7 route-template [incl 2 round-12 status-gate regressions] + 3 server-action + 4 new bootstrap tests = 37 minimum)
- [ ] `pnpm test:e2e` — 9 passing (4 P0 + 5 P1)
- [ ] `pnpm lint` — 0 errors against `app/**` and `lib/**`
- [ ] A new file `app/api/_smoke/route.ts` containing just `export async function GET(){return new Response('x')}` causes `pnpm lint` to emit the `babyloom/api-route-must-assert` error
- [ ] `data/db/babyloom.sqlite` after a fresh boot contains exactly: 1 row in `families`, 1 row in `family_members` (role=owner), 1 row in `users` (role=owner) — verified via `sqlite3 ... 'SELECT COUNT(*) FROM families;'`
- [ ] No `app/api/**/route.ts` exports a bare `GET`/`POST`/etc. without going through the template (`grep -rn "export async function \(GET\|POST\|PUT\|PATCH\|DELETE\)" app/api` against allowlist)
- [ ] All new files have well-defined exports — no dead imports

## Notes for P2 onwards

- When `entries` lands in P2, extend `loadAndAssertTarget`'s `switch (opts.table)` with an `'entries'` case (load + check parent baby join). Pattern is in P1's `babies` case.
- The matrix in `assert.ts` already handles `entry:*` / `media:*` actions — P2/P3 just wire endpoints and add E2E.
- `member:manage` in P1 is only exercised by the unit test; the actual `/api/family-members/*` routes ship in their own plan.
