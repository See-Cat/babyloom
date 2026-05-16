# P2a Babies + Entries (data + endpoints + minimum UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable end-to-end **without media**. After P2a: owner can create a baby (or land in onboarding if none exists), members of any role can see the timeline of active entries for that baby, editor+owner can compose a text entry, entry detail page renders read-only. All CRUD endpoints for babies and entries exist (incl. soft-delete / restore / hard-delete), gated by §5 permissions and the `withAuthorizedResource` template. No trash bin UI (P4), no media UI (P3), no member/milestone admin UI (P2b), no entry edit UI (P2b).

**Architecture:** Add the entries + milestones + entry_milestones + entry_media tables (entry_media is just schema, written by P3). Extend `loadAndAssertTarget` with `entries` case. Introduce a second wrapper `withAuthorizedAction` for non-resource endpoints (list, create) that don't take an `[id]` path param. Extend ESLint `api-route-must-assert` to accept both wrappers. Build the minimum UI flow: home → onboarding-if-no-baby → timeline → compose → detail.

**Tech Stack additions:** none — everything's already in P0/P1.

**Scope boundaries (NOT in P2a):**
- No media subsystem (P3): the `entry_media` join table is created but never written
- No trash bin UI (P4): soft-delete endpoints exist + tested via API/E2E, but no `/profile/trash` page
- No entry edit UI (P2b): PATCH endpoint exists, no compose-existing-entry page
- No member / milestone admin UI (P2b): no `/api/family-members/*`, no `/api/milestones/*`, no profile pages
- No baby picker switching mid-session via UI (P2b): single-baby families work; multi-baby uses a query param fallback
- No design system polish (P5): pages use minimal Tailwind utility classes — text + spacing only, no Animal Crossing tokens

**Spec sections covered:** §3 (entries / milestones / entry_milestones / entry_media schemas); §5 enforcement applied to babies + entries; §6A status machine (active/trashed/purged) for these two resources only; §8 home / onboarding / timeline / compose / detail pages (minimum).

**Spec sections NOT covered yet:** §6 (media), §6A trash bin UI, §6A.4 父链清单 enforcement (entries already JOIN babies; full clipboard codified P3/P4), §7 design system, §8 profile pages, §10 backup, §11 trash/media tests.

---

## File Structure

P2a adds:

```
lib/
├── db/
│   └── schema.ts                       MODIFIED — add entries, milestones, entry_milestones, entry_media
├── db/migrations/0002_*.sql            GENERATED
├── permissions/
│   ├── target-loaders.ts               MODIFIED — add 'entries' case + tests
│   └── action-template.ts              NEW — withAuthorizedAction for list/create endpoints
eslint-rules/
└── api-route-must-assert.js            MODIFIED — accept withAuthorizedAction too
app/
├── page.tsx                            MODIFIED — onboarding / timeline redirect logic
├── onboarding/baby/page.tsx            NEW — first-baby form (owner only)
├── timeline/page.tsx                   NEW — entry list + baby selector
├── entry/
│   ├── new/page.tsx                    NEW — compose form
│   └── [id]/page.tsx                   NEW — read-only detail
└── api/
    ├── babies/
    │   ├── route.ts                    NEW (GET list, POST create)
    │   ├── [id]/route.ts               MODIFIED — extend with PATCH + DELETE
    │   ├── [id]/trash/route.ts         NEW
    │   └── [id]/restore/route.ts       NEW
    └── entries/
        ├── route.ts                    NEW (GET list, POST create)
        ├── [id]/route.ts               NEW (GET, PATCH, DELETE)
        ├── [id]/trash/route.ts         NEW
        └── [id]/restore/route.ts       NEW
tests/
├── lib/permissions/
│   ├── action-template.test.ts         NEW
│   └── target-loaders.test.ts          MODIFIED — add 'entries' edge cases
└── e2e/
    ├── babies.spec.ts                  NEW
    ├── entries.spec.ts                 NEW
    └── main-flow.spec.ts               NEW — login → onboarding → create baby → write entry → see in timeline
```

---

## Task 1: Schema — add entries, milestones, entry_milestones, entry_media

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Append the four tables**

```typescript
// First extend the sqlite-core import:
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

// Then append at the end of lib/db/schema.ts, after the existing exports:

export const entries = sqliteTable(
  'entries',
  {
    id: text('id').primaryKey(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    occurredAt: integer('occurred_at').notNull(), // ms epoch, defaults to createdAt at insert time
    status: text('status').notNull(), // 'active' | 'trashed' | 'purged'
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    deletedBy: text('deleted_by').references(() => users.id)
  },
  (t) => ({
    byBabyStatusOccurred: index('ix_entries_baby_status_occurred').on(
      t.babyId,
      t.status,
      t.occurredAt
    ),
    byStatusDeleted: index('ix_entries_status_deleted').on(t.status, t.deletedAt)
  })
);

export const milestones = sqliteTable('milestones', {
  id: text('id').primaryKey(),
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }), // NULL = system preset
  name: text('name').notNull(),
  icon: text('icon').notNull(), // emoji
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull()
});

export const entryMilestones = sqliteTable(
  'entry_milestones',
  {
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    milestoneId: text('milestone_id')
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' })
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entryId, t.milestoneId] })
  })
);

// entry_media join table — schema only; written by P3 media upload.
// Defined here so the FK target exists when media table lands in P3.
export const entryMedia = sqliteTable(
  'entry_media',
  {
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    mediaId: text('media_id').notNull(), // FK added when media table is created in P3
    attachedBy: text('attached_by')
      .notNull()
      .references(() => users.id),
    attachedAt: integer('attached_at').notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entryId, t.mediaId] }),
    byMedia: index('ix_entry_media_media').on(t.mediaId)
  })
);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(P2a): add entries/milestones/entry_milestones/entry_media schemas"
```

---

## Task 2: Generate + apply migration

- [ ] **Step 1: Generate migration**

Run: `pnpm db:generate`
Expected: a `lib/db/migrations/0002_*.sql` appears containing all four CREATE TABLEs.

- [ ] **Step 2: Verify in scratch DB**

```bash
rm -rf /tmp/babyloom-p2a-smoke
BABYLOOM_DATA_DIR=/tmp/babyloom-p2a-smoke pnpm db:migrate
sqlite3 /tmp/babyloom-p2a-smoke/db/babyloom.sqlite ".tables"
```

Expected: tables include `entries entry_media entry_milestones milestones` plus everything from P0/P1.

- [ ] **Step 3: Commit**

```bash
git add lib/db/migrations/
git commit -m "feat(P2a): migration for entries + milestones + join tables"
```

---

## Task 3: Extend loadAndAssertTarget — add 'entries' case

**Files:**
- Modify: `lib/permissions/target-loaders.ts`

- [ ] **Step 1: Add the entries branch**

In `lib/permissions/target-loaders.ts`, change the `table` type and add a switch case:

```typescript
// Update the LoadAndAssertOptions interface:
export interface LoadAndAssertOptions {
  id: string;
  table: 'babies' | 'entries'; // P2a expands from babies-only
  allowedStatuses?: string[];
  requirePermission: { userId: string; action: Action };
  toResource?: (row: any) => PermissionResource;
  dataDir?: string;
}
```

```typescript
// Inside loadAndAssertTarget, replace the switch:
// Extend the existing schema import to include entries.
import { babies, entries } from '@/lib/db/schema';

// ...
switch (opts.table) {
  case 'babies':
    row = db.select().from(babies).where(eq(babies.id, opts.id)).get();
    break;
  case 'entries':
    row = db
      .select({
        id: entries.id,
        babyId: entries.babyId,
        authorId: entries.authorId,
        content: entries.content,
        occurredAt: entries.occurredAt,
        status: entries.status,
        createdAt: entries.createdAt,
        updatedAt: entries.updatedAt,
        deletedAt: entries.deletedAt,
        deletedBy: entries.deletedBy,
        babyStatus: babies.status
      })
      .from(entries)
      .innerJoin(babies, eq(babies.id, entries.babyId))
      .where(eq(entries.id, opts.id))
      .get();
    if (row && row.babyStatus !== 'active') {
      row = null;
    }
    break;
  default:
    throw new Error(`unsupported table: ${opts.table}`);
}
```

When the caller does not provide `toResource`, derive a sensible default per table:

```typescript
const defaultResource = (row: any): PermissionResource => {
  switch (opts.table) {
    case 'babies':
      return { babyId: row.id };
    case 'entries':
      return { babyId: row.babyId, entryId: row.id, authorId: row.authorId, deletedBy: row.deletedBy ?? undefined };
  }
};
const resource = opts.toResource ? opts.toResource(row) : defaultResource(row);
```

- [ ] **Step 2: Add tests** in `tests/lib/permissions/target-loaders.test.ts`

After the existing babies tests, append:

```typescript
describe('loadAndAssertTarget — entries', () => {
  let dataDir: string;
  let ctx: {
    ownerId: string;
    babyId: string;
    activeEntryId: string;
    trashedEntryId: string;
    hiddenByParentEntryId: string;
  };

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-target-entries-'));
    const seed = await import('./_seed').then((m) => m.seedOwnerBabyEntries(dataDir));
    ctx = seed;
  });

  it('returns active entry for owner', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.activeEntryId,
      table: 'entries',
      allowedStatuses: ['active'],
      requirePermission: { userId: ctx.ownerId, action: 'entry:read' },
      dataDir
    });
    expect(row.id).toBe(ctx.activeEntryId);
  });

  it('NotFoundError on trashed entry when allowedStatuses=[active]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.trashedEntryId,
        table: 'entries',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'entry:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });

  it('returns trashed entry when allowedStatuses=[trashed]', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.trashedEntryId,
      table: 'entries',
      allowedStatuses: ['trashed'],
      requirePermission: { userId: ctx.ownerId, action: 'entry:restore' },
      dataDir
    });
    expect(row.id).toBe(ctx.trashedEntryId);
  });

  it('NotFoundError for active entry under trashed baby', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: ctx.hiddenByParentEntryId,
        table: 'entries',
        allowedStatuses: ['active'],
        requirePermission: { userId: ctx.ownerId, action: 'entry:read' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });
});
```

- [ ] **Step 3: Extract a shared seed helper**

Create `tests/lib/permissions/_seed.ts` to share the "owner + baby + (active+trashed) entries + entry hidden by trashed parent baby" fixture across tests:

```typescript
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export async function seedOwnerBabyEntries(dataDir: string) {
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
  const { users, families, babies, entries } = await import('@/lib/db/schema');
  const { db } = getDb({ dataDir });

  const owner = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];

  const babyId = randomUUID();
  const trashedBabyId = randomUUID();
  const now = Date.now();
  db.insert(babies).values([
    {
      id: babyId, familyId: family.id, name: 'Baby A',
      birthday: '2024-01-01', gender: 'girl',
      status: 'active', createdAt: now, updatedAt: now
    },
    {
      id: trashedBabyId, familyId: family.id, name: 'Baby T',
      birthday: '2024-01-01', gender: 'boy',
      status: 'trashed', createdAt: now, updatedAt: now,
      deletedAt: now, deletedBy: owner.id
    }
  ]).run();

  const activeEntryId = randomUUID();
  const trashedEntryId = randomUUID();
  const hiddenByParentEntryId = randomUUID();
  db.insert(entries).values([
    { id: activeEntryId, babyId, authorId: owner.id, content: 'active',
      occurredAt: now, status: 'active', createdAt: now, updatedAt: now },
    { id: trashedEntryId, babyId, authorId: owner.id, content: 'trashed',
      occurredAt: now, status: 'trashed', createdAt: now, updatedAt: now,
      deletedAt: now, deletedBy: owner.id },
    { id: hiddenByParentEntryId, babyId: trashedBabyId, authorId: owner.id,
      content: 'hidden by parent', occurredAt: now, status: 'active',
      createdAt: now, updatedAt: now }
  ]).run();

  return { ownerId: owner.id, babyId, activeEntryId, trashedEntryId, hiddenByParentEntryId };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/lib/permissions/target-loaders.test.ts`
Expected: 6 (existing babies tests) + 4 (new entries tests) = 10 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/permissions/target-loaders.ts tests/lib/permissions/
git commit -m "feat(P2a): loadAndAssertTarget supports entries; shared seed helper"
```

---

## Task 4: withAuthorizedAction — non-resource endpoint wrapper

**Why:** `withAuthorizedResource` requires an `[id]` path param + loader. List endpoints (`GET /api/babies`) and create endpoints (`POST /api/babies`) have no resource id to load. They still need session + permission. Build a second wrapper with the same auth pipeline minus the loader/status-gate.

**Files:**
- Create: `lib/permissions/action-template.ts`
- Create: `tests/lib/permissions/action-template.test.ts`

- [ ] **Step 1: Write `lib/permissions/action-template.ts`**

```typescript
import { type NextRequest } from 'next/server';
import type { Action, PermissionResource } from './actions';
import { ForbiddenError, UnauthorizedError, NotFoundError } from './errors';
import { jsonNotFound, jsonUnauthorized } from './responses';
import { getSessionUserId } from './session';
import { assertPermission } from './assert';

export interface WithAuthorizedActionOpts {
  action: Action;
  // For action-scoped permissions that need a resource shape derived from
  // the request and trusted session user (e.g. POST /api/entries creates a
  // self-authored entry, so pass { authorId: userId }).
  resolveResource?: (
    req: NextRequest,
    userId: string
  ) => Promise<PermissionResource | undefined>;
}

// Wraps a list / create / other non-resource API route. Pipeline:
//   1. session       → 401 if missing
//   2. resolveResource (optional, server-trusted only — no client field passthrough)
//   3. assertPermission → ForbiddenError → 404 (§5.6)
//   4. handler(req, userId)
//
// Handler receives the trusted userId; the handler itself must use loaders /
// loadAndAssertTarget for any per-resource decisions it makes downstream
// (e.g. a list endpoint that filters by babyId must verify babyId is in the
// caller's family before querying).
export function withAuthorizedAction(opts: WithAuthorizedActionOpts) {
  return function wrap(
    handler: (req: NextRequest, userId: string) => Promise<Response>
  ) {
    return async function route(req: NextRequest): Promise<Response> {
      try {
        let userId: string;
        try {
          userId = await getSessionUserId(req);
        } catch (e) {
          if (e instanceof UnauthorizedError) return jsonUnauthorized();
          throw e;
        }

        const resource = opts.resolveResource ? await opts.resolveResource(req, userId) : undefined;
        await assertPermission(userId, opts.action, resource);

        return await handler(req, userId);
      } catch (e) {
        if (e instanceof ForbiddenError || e instanceof NotFoundError) return jsonNotFound();
        throw e;
      }
    };
  };
}
```

- [ ] **Step 2: Write tests**

```typescript
// tests/lib/permissions/action-template.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedOwnerBabyEntries } from './_seed';

function mockReq(): any {
  return { headers: new Headers() };
}

describe('withAuthorizedAction', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seedOwnerBabyEntries>>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-action-tmpl-'));
    ctx = await seedOwnerBabyEntries(dataDir);
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
  });

  it('401 when no session', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => {
        const { UnauthorizedError } = await import('@/lib/permissions/errors');
        throw new UnauthorizedError();
      }
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({ action: 'baby:read' })(async () => new Response('x'));
    const res = await route(mockReq());
    expect(res.status).toBe(401);
  });

  it('200 for owner on baby:write action', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({ action: 'baby:write' })(async (_req, userId) =>
      Response.json({ userId })
    );
    const res = await route(mockReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(ctx.ownerId);
  });

  it('passes trusted userId into resolveResource', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({
      action: 'entry:write',
      resolveResource: async (_req, userId) => ({ authorId: userId })
    })(async () => Response.json({ ok: true }));
    const res = await route(mockReq());
    expect(res.status).toBe(200);
  });

  it('404 (not 403) when stranger tries baby:write', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => randomUUID()
    }));
    const { withAuthorizedAction } = await import('@/lib/permissions/action-template');
    const route = withAuthorizedAction({ action: 'baby:write' })(async () => new Response('x'));
    const res = await route(mockReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test tests/lib/permissions/action-template.test.ts`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add lib/permissions/action-template.ts tests/lib/permissions/action-template.test.ts
git commit -m "feat(P2a): withAuthorizedAction HOF for non-resource routes"
```

---

## Task 5: Extend ESLint rule — accept withAuthorizedAction

**Files:**
- Modify: `eslint-rules/api-route-must-assert.js`

- [ ] **Step 1: Add the second allowed identifier**

In `leftmostCalleeName` callers, change the acceptance from a strict `=== 'withAuthorizedResource'` to membership in a set:

```javascript
const ALLOWED_WRAPPERS = new Set(['withAuthorizedResource', 'withAuthorizedAction']);

// ...later in the rule body:
const ok =
  init &&
  init.type === 'CallExpression' &&
  ALLOWED_WRAPPERS.has(leftmostCalleeName(init));
```

Update the error message:

```javascript
notWrapped:
  'API route export "{{name}}" must be exported as `export const {{name}} = withAuthorizedResource(...)(handler)` OR `withAuthorizedAction(...)(handler)`. Direct function exports or other initializers are forbidden (spec §5.7).'
```

- [ ] **Step 2: Add fixture #10 — list endpoint with withAuthorizedAction must PASS**

Create a temporary API route that uses `withAuthorizedAction`, run lint, then remove the temporary route:

```bash
mkdir -p app/api/_rule_smoke
cat > app/api/_rule_smoke/route.ts <<'EOF'
import { withAuthorizedAction } from '@/lib/permissions/action-template';
export const GET = withAuthorizedAction({ action: 'baby:read' })(async () => new Response('list'));
EOF
pnpm lint app/api/_rule_smoke/route.ts
rm -rf app/api/_rule_smoke
```

Expected: lint exits 0.

- [ ] **Step 3: Commit**

```bash
git add eslint-rules/api-route-must-assert.js
git commit -m "feat(P2a): ESLint rule accepts withAuthorizedAction wrapper"
```

---

## Task 6: GET /api/babies (list) + POST /api/babies (create)

**Files:**
- Create: `app/api/babies/route.ts`

- [ ] **Step 1: Write `app/api/babies/route.ts`**

```typescript
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, familyMembers } from '@/lib/db/schema';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  name: z.string().min(1).max(50),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date
  gender: z.enum(['boy', 'girl', 'other'])
});

// GET /api/babies — list active babies in caller's family.
// Caller must have baby:read (viewer/editor/owner all do per matrix).
export const GET = withAuthorizedAction({ action: 'baby:read' })(async (_req, userId) => {
  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!member) return Response.json({ babies: [] });

  const rows = db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, member.familyId), eq(babies.status, 'active')))
    .all();

  return Response.json({
    babies: rows.map((b) => ({
      id: b.id,
      name: b.name,
      birthday: b.birthday,
      gender: b.gender,
      avatarUrl: b.avatarUrl
    }))
  });
});

// POST /api/babies — owner only (baby:write is in OWNER_ONLY_ACTIONS).
export const POST = withAuthorizedAction({ action: 'baby:write' })(async (req, userId) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!member) {
    // Shouldn't happen — assertPermission already required family membership
    return jsonBadRequest('no_family');
  }

  const id = randomUUID();
  const now = Date.now();
  db.insert(babies)
    .values({
      id,
      familyId: member.familyId,
      name: parsed.data.name,
      birthday: parsed.data.birthday,
      gender: parsed.data.gender,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
    .run();

  return Response.json(
    {
      id,
      name: parsed.data.name,
      birthday: parsed.data.birthday,
      gender: parsed.data.gender
    },
    { status: 201 }
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/babies/route.ts
git commit -m "feat(P2a): GET /api/babies (list) + POST /api/babies (owner-only create)"
```

---

## Task 7: PATCH + DELETE on /api/babies/[id]

**Files:**
- Modify: `app/api/babies/[id]/route.ts`

- [ ] **Step 1: Append PATCH + DELETE handlers**

```typescript
// Add to the existing file's imports:
import { z } from 'zod';
import { jsonBadRequest } from '@/lib/permissions/responses';
// Extend the existing drizzle import to include and:
import { eq, and } from 'drizzle-orm';

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['boy', 'girl', 'other']).optional(),
  avatarUrl: z.string().url().optional()
});

// PATCH /api/babies/[id] — owner only, edit baby attributes
export const PATCH = withAuthorizedResource({
  action: 'baby:write',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: (row) => ({ babyId: row.id })
})(async (req, _ctx, row) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('validation');

  const { db } = getDb({ dataDir });
  db.update(babies)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(eq(babies.id, row.id))
    .run();

  const updated = db.select().from(babies).where(eq(babies.id, row.id)).get();
  return Response.json({
    id: updated!.id,
    name: updated!.name,
    birthday: updated!.birthday,
    gender: updated!.gender,
    avatarUrl: updated!.avatarUrl
  });
});

// DELETE /api/babies/[id] — owner only, HARD delete (purge).
// Constraint per spec §6A.3: all entries under this baby must be trashed first.
export const DELETE = withAuthorizedResource({
  action: 'baby:purge',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'], // must soft-delete the baby first
  toResource: (row) => ({ babyId: row.id })
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  const { entries } = await import('@/lib/db/schema');
  const live = db
    .select({ count: entries.id })
    .from(entries)
    .where(and(eq(entries.babyId, row.id), eq(entries.status, 'active')))
    .all();
  if (live.length > 0) {
    return Response.json(
      { error: 'has_active_children', detail: 'trash all entries first' },
      { status: 409 }
    );
  }
  db.update(babies)
    .set({ status: 'purged', updatedAt: Date.now() })
    .where(eq(babies.id, row.id))
    .run();
  return Response.json({ purged: row.id });
});
```

(`and` import: add `import { and } from 'drizzle-orm';` if not already present.)

- [ ] **Step 2: Lint**

Run: `pnpm lint app/api/babies/\[id\]/route.ts`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/babies/\[id\]/route.ts
git commit -m "feat(P2a): PATCH + DELETE /api/babies/[id]"
```

---

## Task 8: Babies trash + restore endpoints

**Files:**
- Create: `app/api/babies/[id]/trash/route.ts`
- Create: `app/api/babies/[id]/restore/route.ts`

- [ ] **Step 1: Write trash endpoint**

```typescript
// app/api/babies/[id]/trash/route.ts
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

export const POST = withAuthorizedResource({
  action: 'baby:trash',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: (row) => ({ babyId: row.id })
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  // Note: per spec §6A.4 (parent-chain), descending entries/media stay active
  // by row but become invisible via JOIN filtering in their list endpoints.
  // No cascading state change here.
  const now = Date.now();
  const { getSessionUserId } = await import('@/lib/permissions/session');
  const userId = await getSessionUserId(_req);
  db.update(babies)
    .set({ status: 'trashed', deletedAt: now, deletedBy: userId, updatedAt: now })
    .where(eq(babies.id, row.id))
    .run();
  return Response.json({ trashed: row.id });
});
```

- [ ] **Step 2: Write restore endpoint**

```typescript
// app/api/babies/[id]/restore/route.ts
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

export const POST = withAuthorizedResource({
  action: 'baby:restore',
  loader: loadBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: (row) => ({
    babyId: row.id,
    deletedBy: row.deletedBy ?? undefined
  })
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  db.update(babies)
    .set({
      status: 'active',
      deletedAt: null,
      deletedBy: null,
      updatedAt: Date.now()
    })
    .where(eq(babies.id, row.id))
    .run();
  return Response.json({ restored: row.id });
});
```

- [ ] **Step 3: Lint + commit**

Run: `pnpm lint app/api/babies/`
Expected: 0 errors.

```bash
git add app/api/babies/\[id\]/trash/ app/api/babies/\[id\]/restore/
git commit -m "feat(P2a): POST /api/babies/[id]/{trash,restore}"
```

---

## Task 9: GET /api/entries (list) + POST /api/entries (create)

**Files:**
- Create: `app/api/entries/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { entries, babies } from '@/lib/db/schema';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest, jsonNotFound, UUID_RE } from '@/lib/permissions/responses';
import { loadAndAssertTarget } from '@/lib/permissions/target-loaders';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  babyId: z.string().regex(UUID_RE),
  content: z.string().min(1).max(10000),
  occurredAt: z.number().int().optional() // ms epoch; defaults to now
});

// GET /api/entries?babyId=... — list active entries under one baby.
// Caller must have baby:read on that baby (parent-chain JOIN per §6A.4).
export const GET = withAuthorizedAction({ action: 'baby:read' })(async (req, userId) => {
  const url = new URL(req.url);
  const babyId = url.searchParams.get('babyId');
  if (!babyId || !UUID_RE.test(babyId)) return jsonBadRequest('babyId required');

  // Loader + cross-family enforcement via loadAndAssertTarget
  let baby: any;
  try {
    baby = await loadAndAssertTarget({
      id: babyId,
      table: 'babies',
      allowedStatuses: ['active'],
      requirePermission: { userId, action: 'baby:read' },
      dataDir
    });
  } catch {
    return jsonNotFound();
  }

  const { db } = getDb({ dataDir });
  // Parent-chain JOIN — babies.status MUST be 'active' (already loaded above,
  // but the join is here as defense-in-depth per §6A.4 invariant)
  const rows = db
    .select({
      id: entries.id,
      babyId: entries.babyId,
      authorId: entries.authorId,
      content: entries.content,
      occurredAt: entries.occurredAt,
      createdAt: entries.createdAt
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(and(
      eq(entries.babyId, baby.id),
      eq(entries.status, 'active'),
      eq(babies.status, 'active')
    ))
    .orderBy(desc(entries.occurredAt))
    .all();

  return Response.json({ entries: rows });
});

// POST /api/entries — editor or owner; uses authorId == userId per matrix.
// Spec §5.5.1: babyId is a target field — server loads + verifies + uses DB id.
export const POST = withAuthorizedAction({
  action: 'entry:write',
  resolveResource: async (_req, userId) => {
    // Create-time entry:write is self-authored; the handler below also forces
    // authorId=userId at insert time.
    return { authorId: userId };
  }
})(async (req, userId) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  // Verify babyId is in caller's family — loadAndAssertTarget catches that.
  let baby: any;
  try {
    baby = await loadAndAssertTarget({
      id: parsed.data.babyId,
      table: 'babies',
      allowedStatuses: ['active'],
      requirePermission: { userId, action: 'baby:read' },
      dataDir
    });
  } catch {
    return jsonNotFound();
  }

  const { db } = getDb({ dataDir });
  const id = randomUUID();
  const now = Date.now();
  const occurredAt = parsed.data.occurredAt ?? now;
  db.insert(entries)
    .values({
      id,
      babyId: baby.id, // from DB loader, not request body
      authorId: userId,
      content: parsed.data.content,
      occurredAt,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
    .run();

  return Response.json({ id, babyId: baby.id, authorId: userId, occurredAt }, { status: 201 });
});
```

- [ ] **Step 2: Lint + typecheck**

Run: `pnpm lint app/api/entries/route.ts && pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/entries/route.ts
git commit -m "feat(P2a): GET /api/entries (per-baby) + POST /api/entries (editor+)"
```

---

## Task 10: GET + PATCH + DELETE on /api/entries/[id]

**Files:**
- Create: `app/api/entries/[id]/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { entries, babies, entryMilestones, entryMedia } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadEntryWithActiveBaby(id: string) {
  const { db } = getDb({ dataDir });
  // §6A.4 parent-chain JOIN: surface baby.status so the wrapper can collapse
  // "trashed baby" to 404 (we still call getStatus on entry.status; we also
  // need an extra guard here because allowedStatuses only covers the entry).
  const row = db
    .select({
      id: entries.id,
      babyId: entries.babyId,
      authorId: entries.authorId,
      content: entries.content,
      occurredAt: entries.occurredAt,
      status: entries.status,
      deletedBy: entries.deletedBy,
      createdAt: entries.createdAt,
      updatedAt: entries.updatedAt,
      babyStatus: babies.status
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(eq(entries.id, id))
    .get();
  if (!row) return null;
  // If the parent baby isn't active, hide the entry (§6A.4)
  if (row.babyStatus !== 'active') return null;
  return row;
}

async function loadEntryForPurge(id: string) {
  const { db } = getDb({ dataDir });
  // §6A.4 allows entry purge when parent baby is active or trashed.
  const row = db
    .select({
      id: entries.id,
      babyId: entries.babyId,
      authorId: entries.authorId,
      content: entries.content,
      occurredAt: entries.occurredAt,
      status: entries.status,
      deletedBy: entries.deletedBy,
      createdAt: entries.createdAt,
      updatedAt: entries.updatedAt,
      babyStatus: babies.status
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(eq(entries.id, id))
    .get();
  if (!row) return null;
  if (row.babyStatus !== 'active' && row.babyStatus !== 'trashed') return null;
  return row;
}

const toEntryResource = (row: any) => ({
  babyId: row.babyId,
  entryId: row.id,
  authorId: row.authorId,
  deletedBy: row.deletedBy ?? undefined
});

// GET /api/entries/[id]
export const GET = withAuthorizedResource({
  action: 'entry:read',
  loader: loadEntryWithActiveBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: toEntryResource
})(async (_req, _ctx, row) => {
  return Response.json({
    id: row.id,
    babyId: row.babyId,
    authorId: row.authorId,
    content: row.content,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
});

const patchSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  occurredAt: z.number().int().optional()
});

// PATCH /api/entries/[id] — editor+owner per matrix (editor: own only via authorId check)
export const PATCH = withAuthorizedResource({
  action: 'entry:write',
  loader: loadEntryWithActiveBaby,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: toEntryResource
})(async (req, _ctx, row) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('invalid_json');
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('validation');

  const { db } = getDb({ dataDir });
  db.update(entries)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(eq(entries.id, row.id))
    .run();
  return Response.json({ updated: row.id });
});

// DELETE /api/entries/[id] — owner only purge (entry:purge in OWNER_ONLY_ACTIONS)
export const DELETE = withAuthorizedResource({
  action: 'entry:purge',
  loader: loadEntryForPurge,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'], // must soft-delete first
  toResource: toEntryResource
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  db.delete(entryMilestones).where(eq(entryMilestones.entryId, row.id)).run();
  db.delete(entryMedia).where(eq(entryMedia.entryId, row.id)).run();
  db.update(entries)
    .set({ status: 'purged', updatedAt: Date.now() })
    .where(eq(entries.id, row.id))
    .run();
  return Response.json({ purged: row.id });
});
```

- [ ] **Step 2: Lint + commit**

```bash
pnpm lint app/api/entries/\[id\]/route.ts
git add app/api/entries/\[id\]/route.ts
git commit -m "feat(P2a): GET + PATCH + DELETE /api/entries/[id]"
```

---

## Task 11: Entries trash + restore endpoints

**Files:**
- Create: `app/api/entries/[id]/trash/route.ts`
- Create: `app/api/entries/[id]/restore/route.ts`

- [ ] **Step 1: Trash endpoint**

```typescript
// app/api/entries/[id]/trash/route.ts
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { entries, babies } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { getSessionUserId } from '@/lib/permissions/session';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadEntry(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: entries.id, babyId: entries.babyId, authorId: entries.authorId,
      status: entries.status, deletedBy: entries.deletedBy,
      babyStatus: babies.status
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(eq(entries.id, id))
    .get();
  if (!row || row.babyStatus !== 'active') return null;
  return row;
}

export const POST = withAuthorizedResource({
  action: 'entry:trash',
  loader: loadEntry,
  getStatus: (row) => row.status,
  allowedStatuses: ['active'],
  toResource: (row) => ({
    babyId: row.babyId, entryId: row.id, authorId: row.authorId
  })
})(async (req, _ctx, row) => {
  const userId = await getSessionUserId(req);
  const { db } = getDb({ dataDir });
  const now = Date.now();
  db.update(entries)
    .set({ status: 'trashed', deletedAt: now, deletedBy: userId, updatedAt: now })
    .where(eq(entries.id, row.id))
    .run();
  return Response.json({ trashed: row.id });
});
```

- [ ] **Step 2: Restore endpoint**

```typescript
// app/api/entries/[id]/restore/route.ts
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { getDb } from '@/lib/db/client';
import { entries, babies } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadEntry(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      id: entries.id, babyId: entries.babyId, authorId: entries.authorId,
      status: entries.status, deletedBy: entries.deletedBy,
      babyStatus: babies.status
    })
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(eq(entries.id, id))
    .get();
  if (!row || row.babyStatus !== 'active') return null;
  return row;
}

export const POST = withAuthorizedResource({
  action: 'entry:restore',
  loader: loadEntry,
  getStatus: (row) => row.status,
  allowedStatuses: ['trashed'],
  toResource: (row) => ({
    babyId: row.babyId,
    entryId: row.id,
    authorId: row.authorId,
    deletedBy: row.deletedBy ?? undefined
  })
})(async (_req, _ctx, row) => {
  const { db } = getDb({ dataDir });
  db.update(entries)
    .set({ status: 'active', deletedAt: null, deletedBy: null, updatedAt: Date.now() })
    .where(eq(entries.id, row.id))
    .run();
  return Response.json({ restored: row.id });
});
```

- [ ] **Step 3: Lint + commit**

```bash
pnpm lint app/api/entries/
git add app/api/entries/\[id\]/trash/ app/api/entries/\[id\]/restore/
git commit -m "feat(P2a): POST /api/entries/[id]/{trash,restore}"
```

---

## Task 12: Onboarding page (create-first-baby)

**Why:** First boot has owner but no babies. Without a baby the user has nothing to do. Force a create form.

**Files:**
- Create: `app/onboarding/baby/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingBabyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/babies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: String(formData.get('name') ?? ''),
        birthday: String(formData.get('birthday') ?? ''),
        gender: String(formData.get('gender') ?? 'other')
      })
    });
    setPending(false);
    if (!res.ok) {
      setError('创建失败,请检查输入');
      return;
    }
    router.push('/timeline');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={onSubmit} className="w-full max-w-md flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">第一个宝宝</h1>
        <p className="text-sm opacity-75">先添加一个宝宝才能开始记录</p>
        <input name="name" required placeholder="宝宝名字" className="border rounded px-3 py-2" />
        <input name="birthday" required type="date" className="border rounded px-3 py-2" />
        <select name="gender" required className="border rounded px-3 py-2">
          <option value="girl">女宝</option>
          <option value="boy">男宝</option>
          <option value="other">其他</option>
        </select>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {pending ? '创建中…' : '创建宝宝'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/onboarding/
git commit -m "feat(P2a): onboarding page for first-baby creation"
```

---

## Task 13: Home redirect logic

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace home page with server-side redirect**

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolve } from 'node:path';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { babies, familyMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function HomePage() {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .get();
  if (!member) redirect('/login');

  const activeBabies = db
    .select({ id: babies.id })
    .from(babies)
    .where(and(eq(babies.familyId, member.familyId), eq(babies.status, 'active')))
    .all();

  if (activeBabies.length === 0) {
    redirect('/onboarding/baby');
  }
  redirect('/timeline');
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat(P2a): home redirects to /onboarding/baby or /timeline based on state"
```

---

## Task 14: Timeline page

**Why:** Core view. Lists active entries for the currently-selected baby.

**Files:**
- Create: `app/timeline/page.tsx`

- [ ] **Step 1: Write the server component**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import Link from 'next/link';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { babies, familyMembers, entries } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function TimelinePage({
  searchParams
}: {
  searchParams: Promise<{ babyId?: string }>;
}) {
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .get();
  if (!member) redirect('/login');

  const familyBabies = db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, member.familyId), eq(babies.status, 'active')))
    .all();

  if (familyBabies.length === 0) redirect('/onboarding/baby');

  const sp = await searchParams;
  const selectedBabyId = sp.babyId && familyBabies.some((b) => b.id === sp.babyId)
    ? sp.babyId
    : familyBabies[0].id;

  const rows = db
    .select()
    .from(entries)
    .innerJoin(babies, eq(babies.id, entries.babyId))
    .where(and(
      eq(entries.babyId, selectedBabyId),
      eq(entries.status, 'active'),
      eq(babies.status, 'active')
    ))
    .orderBy(desc(entries.occurredAt))
    .all();

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">时间线</h1>
        <Link
          href={`/entry/new?babyId=${selectedBabyId}`}
          className="bg-black text-white text-sm rounded px-3 py-1.5"
        >
          + 新记录
        </Link>
      </header>

      {familyBabies.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {familyBabies.map((b) => (
            <Link
              key={b.id}
              href={`/timeline?babyId=${b.id}`}
              className={`px-3 py-1.5 text-sm rounded border ${
                b.id === selectedBabyId ? 'bg-black text-white' : ''
              }`}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm opacity-60 text-center mt-8">还没有记录</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.entries.id} className="border rounded p-3">
              <Link href={`/entry/${r.entries.id}`} className="block">
                <p className="text-xs opacity-60 mb-1">
                  {new Date(r.entries.occurredAt).toLocaleString('zh-CN')}
                </p>
                <p className="line-clamp-3 whitespace-pre-wrap">{r.entries.content}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/timeline/
git commit -m "feat(P2a): timeline page with baby selector + entry list"
```

---

## Task 15: Compose new entry page

**Files:**
- Create: `app/entry/new/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function NewEntryForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const babyId = sp.get('babyId') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!babyId) router.replace('/timeline');
  }, [babyId, router]);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        babyId,
        content: String(formData.get('content') ?? '')
      })
    });
    setPending(false);
    if (!res.ok) {
      setError(res.status === 404 ? '没有权限' : '提交失败');
      return;
    }
    const data = await res.json();
    router.push(`/entry/${data.id}`);
    router.refresh();
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <form action={onSubmit} className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">新记录</h1>
        <textarea
          name="content"
          required
          rows={8}
          placeholder="今天发生了什么…"
          className="border rounded px-3 py-2 resize-none"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewEntryForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/entry/new/
git commit -m "feat(P2a): compose new entry page"
```

---

## Task 16: Entry detail page (read-only)

**Files:**
- Create: `app/entry/[id]/page.tsx`

- [ ] **Step 1: Write the server component**

```tsx
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { resolve } from 'node:path';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { entries, babies, users } from '@/lib/db/schema';
import { loadAndAssertTarget } from '@/lib/permissions/target-loaders';
import { ForbiddenError, NotFoundError } from '@/lib/permissions/errors';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function EntryDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = getAuth({ dataDir });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/login');

  let entry: any;
  try {
    entry = await loadAndAssertTarget({
      id,
      table: 'entries',
      allowedStatuses: ['active'],
      requirePermission: { userId: session.user.id, action: 'entry:read' },
      dataDir
    });
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof NotFoundError) notFound();
    throw e;
  }

  const { db } = getDb({ dataDir });
  const author = db.select().from(users).where(eq(users.id, entry.authorId)).get();
  const baby = db.select().from(babies).where(eq(babies.id, entry.babyId)).get();

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href={`/timeline?babyId=${entry.babyId}`} className="text-sm opacity-60">
        ← 时间线
      </Link>
      <article className="mt-4">
        <header className="mb-4">
          <p className="text-xs opacity-60">
            {baby?.name} · {new Date(entry.occurredAt).toLocaleString('zh-CN')}
          </p>
          <p className="text-xs opacity-60">作者:{author?.name ?? '未知'}</p>
        </header>
        <p className="whitespace-pre-wrap text-base">{entry.content}</p>
      </article>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/entry/\[id\]/
git commit -m "feat(P2a): entry detail page (read-only)"
```

---

## Task 17: Update existing E2E expectations + isolation helpers

**Why:** P2a changes `/` from a static post-login page into redirect logic, so the P0 login E2E expectation must change. P2a also adds more E2E specs that mutate babies/entries; tests must not depend on Playwright file execution order.

**Files:**
- Modify: `tests/e2e/login.spec.ts`
- Modify: `tests/e2e/permissions.spec.ts`
- Modify: `tests/e2e/fixtures.ts`

- [ ] **Step 1: Update the successful-login expectation**

In `tests/e2e/login.spec.ts`, replace the old home-page assertion:

```typescript
await expect(page).toHaveURL('/');
await expect(page.getByRole('heading', { name: 'Babyloom' })).toBeVisible();
```

with:

```typescript
await page.waitForURL(/\/(onboarding\/baby|timeline)$/);
await expect(page.getByRole('heading', { name: /第一个宝宝|时间线/ })).toBeVisible();
```

- [ ] **Step 2: Update permissions E2E post-login waits**

In `tests/e2e/permissions.spec.ts`, replace each post-login wait:

```typescript
await page.waitForURL('/');
```

with:

```typescript
await page.waitForURL('**/timeline');
```

`seedE2eExtras()` creates an active baby before these tests, so `/` should now resolve to `/timeline`.

- [ ] **Step 3: Add an E2E domain-data reset helper**

Append this helper to `tests/e2e/fixtures.ts`:

```typescript
export async function resetE2eDomainData() {
  const dataDir = resolve(process.cwd(), 'test-data/e2e');
  process.env.BABYLOOM_DATA_DIR = dataDir;

  const { resetDbForTesting, getDb } = await import('../../lib/db/client');
  resetDbForTesting();
  const { db } = getDb({ dataDir });
  const { babies, babyMemberPermissions, entries, entryMilestones, entryMedia } =
    await import('../../lib/db/schema');

  db.delete(entryMedia).run();
  db.delete(entryMilestones).run();
  db.delete(entries).run();
  db.delete(babyMemberPermissions).run();
  db.delete(babies).run();
}
```

- [ ] **Step 4: Run existing E2E smoke**

Run: `pnpm test:e2e tests/e2e/login.spec.ts tests/e2e/permissions.spec.ts`
Expected: both files pass with the updated redirect behavior.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/login.spec.ts tests/e2e/permissions.spec.ts tests/e2e/fixtures.ts
git commit -m "test(P2a): update e2e login expectations and isolate domain data"
```

---

## Task 18: E2E — main flow

**Files:**
- Create: `tests/e2e/main-flow.spec.ts`

- [ ] **Step 1: Write the E2E test**

```typescript
import { test, expect } from '@playwright/test';
import { resetE2eDomainData } from './fixtures';

test.describe.serial('main flow: login → onboarding → create baby → write entry → see in timeline', () => {
  test.beforeAll(async () => {
    await resetE2eDomainData();
  });

  test('owner end-to-end', async ({ page }) => {
    // 1. login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');

    // 2. expect redirect to /onboarding/baby (no babies yet)
    await page.waitForURL('**/onboarding/baby');

    // 3. fill baby form
    await page.fill('input[name="name"]', 'E2E Baby');
    await page.fill('input[name="birthday"]', '2024-01-01');
    await page.selectOption('select[name="gender"]', 'girl');
    await page.click('button[type="submit"]');

    // 4. now on timeline (empty)
    await page.waitForURL('**/timeline*');
    await expect(page.getByText('还没有记录')).toBeVisible();

    // 5. compose entry
    await page.click('text=+ 新记录');
    await page.waitForURL('**/entry/new*');
    await page.fill('textarea[name="content"]', '今天宝宝第一次笑了!');
    await page.click('button[type="submit"]');

    // 6. expect detail page
    await page.waitForURL(/\/entry\/[0-9a-f-]+$/);
    await expect(page.getByText('今天宝宝第一次笑了!')).toBeVisible();

    // 7. back to timeline shows the entry
    await page.goto('/timeline');
    await expect(page.getByText('今天宝宝第一次笑了!')).toBeVisible();
  });

  test('second visit goes straight to timeline (not onboarding)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/timeline*');
  });
});
```

- [ ] **Step 2: Run e2e**

Run: `pnpm test:e2e`
Expected: All P0 + P1 + P2a tests pass. Main-flow resets only babies/entries domain data, then verifies fresh onboarding and same-session second login behavior.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/main-flow.spec.ts
git commit -m "test(P2a): E2E main flow login→onboarding→entry"
```

---

## Task 19: API E2E for babies + entries CRUD + trash + restore + purge

**Files:**
- Create: `tests/e2e/babies.spec.ts`
- Create: `tests/e2e/entries.spec.ts`

- [ ] **Step 1: Babies API spec — list / create / patch / trash / restore / purge**

```typescript
// tests/e2e/babies.spec.ts
import { test, expect } from '@playwright/test';

async function signInAsOwner(request: any) {
  const res = await request.post('/api/auth/sign-in/email', {
    data: { email: 'e2eowner@local.babyloom', password: 'e2epassword' }
  });
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies.split(/,(?=\s*\w+=)/).map((c: string) => c.split(';')[0].trim()).join('; ');
}

test.describe.serial('babies API', () => {
  let cookie: string;
  let babyId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
  });

  test('owner can create a baby', async ({ request }) => {
    const res = await request.post('/api/babies', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'API Baby', birthday: '2024-06-01', gender: 'boy' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('API Baby');
    babyId = body.id;
  });

  test('GET /api/babies lists active babies', async ({ request }) => {
    const res = await request.get('/api/babies', { headers: { cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.babies.some((b: any) => b.id === babyId)).toBe(true);
  });

  test('PATCH /api/babies/[id] updates fields', async ({ request }) => {
    const res = await request.patch(`/api/babies/${babyId}`, {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'API Baby Updated' }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('API Baby Updated');
  });

  test('soft-delete moves baby out of list', async ({ request }) => {
    const res = await request.post(`/api/babies/${babyId}/trash`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/babies', { headers: { cookie } });
    const body = await list.json();
    expect(body.babies.some((b: any) => b.id === babyId)).toBe(false);
  });

  test('restore brings baby back', async ({ request }) => {
    const res = await request.post(`/api/babies/${babyId}/restore`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/babies', { headers: { cookie } });
    const body = await list.json();
    expect(body.babies.some((b: any) => b.id === babyId)).toBe(true);
  });

  test('purge requires trashed status — 404 on active', async ({ request }) => {
    const res = await request.delete(`/api/babies/${babyId}`, { headers: { cookie } });
    expect(res.status()).toBe(404); // status gate rejects active
  });

  test('purge succeeds after trash when no active child entries remain', async ({ request }) => {
    const trash = await request.post(`/api/babies/${babyId}/trash`, { headers: { cookie } });
    expect(trash.status()).toBe(200);
    const res = await request.delete(`/api/babies/${babyId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/babies', { headers: { cookie } });
    const body = await list.json();
    expect(body.babies.some((b: any) => b.id === babyId)).toBe(false);
  });
});
```

- [ ] **Step 2: Entries API spec — list / create / patch / trash / restore / purge**

```typescript
// tests/e2e/entries.spec.ts
import { test, expect } from '@playwright/test';

async function signInAsOwner(request: any) {
  const res = await request.post('/api/auth/sign-in/email', {
    data: { email: 'e2eowner@local.babyloom', password: 'e2epassword' }
  });
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies.split(/,(?=\s*\w+=)/).map((c: string) => c.split(';')[0].trim()).join('; ');
}

test.describe.serial('entries API', () => {
  let cookie: string;
  let babyId: string;
  let entryId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
    const baby = await request.post('/api/babies', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'Entries API Baby', birthday: '2024-07-01', gender: 'other' }
    });
    expect(baby.status()).toBe(201);
    const body = await baby.json();
    babyId = body.id;
  });

  test('create entry', async ({ request }) => {
    const res = await request.post('/api/entries', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { babyId, content: 'hello world' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.babyId).toBe(babyId);
    entryId = body.id;
  });

  test('list entries returns the new one', async ({ request }) => {
    const res = await request.get(`/api/entries?babyId=${babyId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.entries.some((e: any) => e.id === entryId)).toBe(true);
  });

  test('GET single entry', async ({ request }) => {
    const res = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.content).toBe('hello world');
  });

  test('PATCH single entry', async ({ request }) => {
    const res = await request.patch(`/api/entries/${entryId}`, {
      headers: { cookie, 'content-type': 'application/json' },
      data: { content: 'hello world edited' }
    });
    expect(res.status()).toBe(200);
    const get = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    const body = await get.json();
    expect(body.content).toBe('hello world edited');
  });

  test('trash removes from list', async ({ request }) => {
    const trash = await request.post(`/api/entries/${entryId}/trash`, { headers: { cookie } });
    expect(trash.status()).toBe(200);
    const list = await request.get(`/api/entries?babyId=${babyId}`, { headers: { cookie } });
    const body = await list.json();
    expect(body.entries.some((e: any) => e.id === entryId)).toBe(false);
  });

  test('GET trashed entry returns 404 (status gate)', async ({ request }) => {
    const res = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(res.status()).toBe(404);
  });

  test('restore brings it back', async ({ request }) => {
    const res = await request.post(`/api/entries/${entryId}/restore`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get(`/api/entries?babyId=${babyId}`, { headers: { cookie } });
    const body = await list.json();
    expect(body.entries.some((e: any) => e.id === entryId)).toBe(true);
  });

  test('purge succeeds after trash', async ({ request }) => {
    const trash = await request.post(`/api/entries/${entryId}/trash`, { headers: { cookie } });
    expect(trash.status()).toBe(200);
    const res = await request.delete(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const get = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(get.status()).toBe(404);
  });
});
```

- [ ] **Step 3: Run e2e**

Run: `pnpm test:e2e`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/babies.spec.ts tests/e2e/entries.spec.ts
git commit -m "test(P2a): API E2E for babies + entries CRUD + status gating"
```

---

## P2a Acceptance Checklist

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` ≥ P1's 37 + Task 4 (4 action-template) + Task 3 (4 entries target-loader) = **45 passing**
- [ ] `pnpm test:e2e` — P1's 9 + P2a's main-flow (2) + babies (7) + entries (8) = **26 passing**
- [ ] `pnpm lint` — 0 errors; lint negative fixtures 1-9 + new fixture 10 (`withAuthorizedAction` positive) all behave as documented
- [ ] Fresh boot with no babies → owner logs in → lands on `/onboarding/baby` (not 404, not blank)
- [ ] After onboarding → next login → `/timeline` directly (no onboarding flash)
- [ ] Compose entry → detail page renders the entered text
- [ ] Timeline shows the new entry first (occurredAt DESC)
- [ ] `POST /api/babies` as editor → 404 (owner-only enforced via `OWNER_ONLY_ACTIONS`)
- [ ] `GET /api/entries/[id]` for a trashed entry → 404 (status gate in wrapper)
- [ ] No `app/api/**/route.ts` exports outside the two wrappers (`grep -rE "^export (async )?function (GET\|POST\|PUT\|PATCH\|DELETE)" app/api` returns 0)

## Notes for P2b onwards

- **P2b** = entry edit UI, member admin (CRUD), milestone admin, baby admin pages, profile pages, full design polish prerequisites
- **P3** = media subsystem; `entry_media` join table is already in place — P3 writes it and adds the media table itself
- **P4** = trash bin UI (the soft-delete endpoints exist here; UI to list `status='trashed'` + restore/purge buttons + 16-item parent-chain checklist enforcement comes in P4)
