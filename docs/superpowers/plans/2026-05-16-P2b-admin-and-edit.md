# P2b Member + Milestone admin + Entry edit + Profile pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner can manage family members (add/edit/remove/password reset), manage milestones (create/edit/delete), and edit existing entries with milestone attachments. End state: a single-owner family can scale to multi-member; owner has profile pages for member/baby/milestone admin; editor sees timeline + composes + edits entries; viewers see read-only. After P2b the data model and core CRUD are exercise-complete — only media (P3), trash bin UI (P4), design polish (P5), backup/deploy (P6) remain.

**Architecture:** Adds two new endpoint families (`/api/family-members/*`, `/api/milestones/*`) gated by `member:manage` / `milestone:manage` (both owner-only via P1 `OWNER_ONLY_ACTIONS`). Extends `loadAndAssertTarget` to load `milestones` and `users` (for `memberId`). Refactors the bootstrap's user+account dual-write into a shared `createMember(...)` helper so the same code path serves both first-boot bootstrap and runtime member creation. Entries gain optional `milestoneIds` in POST + PATCH bodies, writing `entry_milestones` join rows in the same transaction. Adds 5 profile pages (home, babies, members, milestones, entry-edit).

**Tech Stack additions:** none.

**Scope boundaries (NOT in P2b):**
- No media (P3): entries still text-only here
- No trash bin UI (P4): trash/restore endpoints exist from P2a; UI to browse `status='trashed'` lands in P4
- No design system polish (P5): minimal Tailwind utility classes only
- No `baby_member_permissions` override UI (P4 or later): the table schema + permission logic exist from P1; admin UI to set per-baby fine-grained permissions is a later plan (the override is rarely used and YAGNI for first ship)
- No self-service password change for non-owners (spec §4.2): owner resets all member passwords; viewer/editor cannot change their own password — documented limitation
- No baby creation here: P2a's onboarding + owner-only `POST /api/babies` already covers it; P2b only adds the **management** page (rename / soft-delete / restore)

**Spec sections covered:** §3 milestones (CRUD), §3 family_members (CRUD), §5.4 `member:manage` / `milestone:manage` enforcement, §8 profile pages (full), §8 entry edit page.

**Spec sections NOT covered yet:** §6 media (P3), §6A trash bin UI (P4), §7 design polish (P5), §10 backup (P6).

---

## File Structure

P2b adds:

```
lib/
├── permissions/
│   └── target-loaders.ts                MODIFIED — add 'milestones' + 'users' cases
└── members/
    └── create.ts                        NEW — shared createMember(users + accounts dual write)
app/
├── api/
│   ├── family-members/
│   │   ├── route.ts                     NEW (GET list, POST create)
│   │   └── [id]/route.ts                NEW (PATCH role/password, DELETE)
│   ├── milestones/
│   │   ├── route.ts                     NEW (GET list, POST create)
│   │   └── [id]/route.ts                NEW (PATCH, DELETE)
├── entry/[id]/edit/page.tsx             NEW — entry edit form
└── profile/
    ├── page.tsx                         NEW — profile home / link hub
    ├── babies/page.tsx                  NEW — baby management list
    ├── members/page.tsx                 NEW — member list + create form
    └── milestones/page.tsx              NEW — milestone list + create form
tests/
├── lib/members/
│   └── create.test.ts                   NEW
└── e2e/
    ├── members.spec.ts                  NEW
    ├── milestones.spec.ts               NEW
    └── entry-edit.spec.ts               NEW
```

---

## Task 1: Shared createMember helper

**Why:** Bootstrap (`bootstrapOwner`) and the new `POST /api/family-members` endpoint both need to write a `users` row + `accounts` credential row + `family_members` row in one transaction. P1 inlined this in bootstrap; copy-pasting it into the API route would be a schema-drift trap. Refactor it out **first**, before the API route depends on the pattern.

**Files:**
- Create: `lib/members/create.ts`
- Create: `tests/lib/members/create.test.ts`

> **Bootstrap is NOT refactored** in this task. Bootstrap retains its current implementation because the family<->ownerUserId circular FK relationship is easier handled inline than via a shared helper that assumes `familyId` already exists. `createMember` is used only by the runtime member admin endpoint.

- [ ] **Step 1: Write `lib/members/create.ts`**

```typescript
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users, accounts, familyMembers } from '@/lib/db/schema';
import { hashPassword, ownerInternalEmail } from '@/lib/bootstrap/owner';

export interface CreateMemberOpts {
  dataDir: string;
  familyId: string;
  username: string;
  password: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface CreateMemberResult {
  userId: string;
  memberId: string;
  email: string;
}

/**
 * Creates a user + credential account + family_members row in a single
 * transaction. Returns the generated ids. Throws if username already exists.
 *
 * The dual-write to users+accounts is the spec §3.2 invariant — never call
 * db.insert(users) for a new account without also inserting
 * accounts(providerId='credential').
 */
export async function createMember(opts: CreateMemberOpts): Promise<CreateMemberResult> {
  const { db } = getDb({ dataDir: opts.dataDir });

  const existingByUsername = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, opts.username))
    .get();
  if (existingByUsername) {
    throw new Error('username_taken');
  }

  const userId = randomUUID();
  const memberId = randomUUID();
  const email = ownerInternalEmail(opts.username);
  const now = new Date();
  const nowMs = Date.now();
  const passwordHash = hashPassword(opts.password);

  db.transaction((tx) => {
    tx.insert(users)
      .values({
        id: userId,
        name: opts.nickname,
        email,
        emailVerified: true,
        username: opts.username,
        role: opts.role,
        createdAt: now,
        updatedAt: now
      })
      .run();
    tx.insert(accounts)
      .values({
        id: randomUUID(),
        userId,
        providerId: 'credential',
        accountId: email,
        password: passwordHash,
        createdAt: now,
        updatedAt: now
      })
      .run();
    tx.insert(familyMembers)
      .values({
        id: memberId,
        familyId: opts.familyId,
        userId,
        role: opts.role,
        joinedAt: nowMs
      })
      .run();
  });

  return { userId, memberId, email };
}

/**
 * Resets a member's credential password. Touches accounts.password only.
 */
export function resetMemberPassword(opts: {
  dataDir: string;
  userId: string;
  newPassword: string;
}): void {
  const { db } = getDb({ dataDir: opts.dataDir });
  const passwordHash = hashPassword(opts.newPassword);
  const now = new Date();

  const cred = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, opts.userId), eq(accounts.providerId, 'credential')))
    .get();
  if (!cred) throw new Error('no_credential_account');

  db.update(accounts)
    .set({ password: passwordHash, updatedAt: now })
    .where(eq(accounts.id, cred.id))
    .run();
}
```

- [ ] **Step 2: Write `tests/lib/members/create.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, and } from 'drizzle-orm';

async function freshFamily(dataDir: string) {
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
  const { families } = await import('@/lib/db/schema');
  return { familyId: db.select().from(families).all()[0].id };
}

describe('createMember', () => {
  let dataDir: string;
  let familyId: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-create-member-'));
    ({ familyId } = await freshFamily(dataDir));
  });

  it('creates user + credential account + family_members in one go', async () => {
    const { createMember } = await import('@/lib/members/create');
    const { userId, memberId, email } = await createMember({
      dataDir,
      familyId,
      username: 'alice',
      password: 'alicepass',
      nickname: 'Alice',
      role: 'editor'
    });
    expect(email).toBe('alice@local.babyloom');

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { users, accounts, familyMembers } = await import('@/lib/db/schema');

    const u = db.select().from(users).where(eq(users.id, userId)).get();
    expect(u?.username).toBe('alice');
    expect(u?.role).toBe('editor');

    const cred = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
      .get();
    expect(cred?.password).toBeTruthy();
    expect(cred?.accountId).toBe(email);

    const m = db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId))
      .get();
    expect(m?.role).toBe('editor');
    expect(m?.familyId).toBe(familyId);
  });

  it('rejects duplicate username', async () => {
    const { createMember } = await import('@/lib/members/create');
    await createMember({
      dataDir, familyId, username: 'alice', password: 'p1longenuf', nickname: 'A', role: 'editor'
    });
    await expect(
      createMember({
        dataDir, familyId, username: 'alice', password: 'p2longenuf', nickname: 'A2', role: 'viewer'
      })
    ).rejects.toThrow(/username_taken/);
  });

  it('the created member can sign in with the chosen password', async () => {
    const { createMember } = await import('@/lib/members/create');
    const { verifyPassword } = await import('@/lib/bootstrap/owner');
    await createMember({
      dataDir, familyId, username: 'bob', password: 'bobsecure', nickname: 'Bob', role: 'viewer'
    });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { accounts, users } = await import('@/lib/db/schema');
    const u = db.select().from(users).where(eq(users.username, 'bob')).get();
    const cred = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, u!.id), eq(accounts.providerId, 'credential')))
      .get();
    expect(verifyPassword('bobsecure', cred!.password!)).toBe(true);
    expect(verifyPassword('wrong', cred!.password!)).toBe(false);
  });

  it('resetMemberPassword updates accounts.password only', async () => {
    const { createMember, resetMemberPassword } = await import('@/lib/members/create');
    const { verifyPassword } = await import('@/lib/bootstrap/owner');
    const { userId } = await createMember({
      dataDir, familyId, username: 'carol', password: 'oldlongenuf', nickname: 'C', role: 'editor'
    });
    resetMemberPassword({ dataDir, userId, newPassword: 'newlongenuf' });

    const { getDb } = await import('@/lib/db/client');
    const { db } = getDb({ dataDir });
    const { accounts, users } = await import('@/lib/db/schema');
    const cred = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
      .get();
    expect(verifyPassword('newlongenuf', cred!.password!)).toBe(true);
    expect(verifyPassword('oldlongenuf', cred!.password!)).toBe(false);

    const u = db.select().from(users).where(eq(users.id, userId)).get();
    expect(u?.username).toBe('carol');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test tests/lib/members/create.test.ts`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add lib/members/ tests/lib/members/
git commit -m "feat(P2b): shared createMember + resetMemberPassword helpers"
```

---

## Task 2: Extend loadAndAssertTarget — 'milestones' + 'users'

**Files:**
- Modify: `lib/permissions/target-loaders.ts`
- Modify: `tests/lib/permissions/target-loaders.test.ts`

- [ ] **Step 1: Add milestones + users branches**

In `lib/permissions/target-loaders.ts`:

```typescript
// Update the table union:
table: 'babies' | 'entries' | 'milestones' | 'users';

// Inside the switch:
case 'milestones': {
  const { milestones } = await import('@/lib/db/schema');
  row = db.select().from(milestones).where(eq(milestones.id, opts.id)).get();
  break;
}
case 'users': {
  const { users } = await import('@/lib/db/schema');
  row = db.select().from(users).where(eq(users.id, opts.id)).get();
  break;
}
```

Default resource mapping additions:

```typescript
case 'milestones':
  return {}; // milestone:manage is family-scoped not baby-scoped; no fields needed
case 'users':
  return { targetUserId: row.id };
```

- [ ] **Step 2: Add tests** (append to `tests/lib/permissions/target-loaders.test.ts`)

```typescript
describe('loadAndAssertTarget — milestones', () => {
  let dataDir: string;
  let ctx: { ownerId: string; milestoneId: string };

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-target-milestones-'));
    const { seedOwnerBabyEntries } = await import('./_seed');
    const seed = await seedOwnerBabyEntries(dataDir);
    const { randomUUID } = await import('node:crypto');
    const { getDb } = await import('@/lib/db/client');
    const { milestones, families } = await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });
    const familyId = db.select().from(families).all()[0].id;
    const milestoneId = randomUUID();
    db.insert(milestones)
      .values({ id: milestoneId, familyId, name: 'First smile', icon: '😊', sortOrder: 0, createdAt: Date.now() })
      .run();
    ctx = { ownerId: seed.ownerId, milestoneId };
  });

  it('owner loads milestone for milestone:manage', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    const row = await loadAndAssertTarget<any>({
      id: ctx.milestoneId,
      table: 'milestones',
      requirePermission: { userId: ctx.ownerId, action: 'milestone:manage' },
      dataDir
    });
    expect(row.id).toBe(ctx.milestoneId);
  });

  it('non-uuid id → 404', async () => {
    const { loadAndAssertTarget } = await import('@/lib/permissions/target-loaders');
    await expect(
      loadAndAssertTarget({
        id: 'bad', table: 'milestones',
        requirePermission: { userId: ctx.ownerId, action: 'milestone:manage' },
        dataDir
      })
    ).rejects.toThrow(/not_found/);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test tests/lib/permissions/target-loaders.test.ts`
Expected: previous count + 2 = 11+ passing.

- [ ] **Step 4: Commit**

```bash
git add lib/permissions/target-loaders.ts tests/lib/permissions/target-loaders.test.ts
git commit -m "feat(P2b): loadAndAssertTarget supports milestones + users"
```

---

## Task 3: Family-scope check for member:manage in assert.ts

**Why:** `member:manage` is owner-only (already enforced), but the matrix must additionally verify the target user (`resource.targetUserId`) is in the SAME family as the caller. Defense-in-depth for the single-deployment-multi-family edge case.

**Files:**
- Modify: `lib/permissions/assert.ts`
- Modify: `tests/lib/permissions/assert.test.ts`

- [ ] **Step 1: Add cross-family guard in assertPermission**

In `lib/permissions/assert.ts`, after the membership lookup and **before** `checkOwnershipMatrix`:

```typescript
if (action === 'member:manage' && resource?.targetUserId) {
  const targetMember = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, resource.targetUserId))
    .get();
  if (!targetMember || targetMember.familyId !== member.familyId) {
    throw new ForbiddenError(action, 'target_not_in_family');
  }
}
```

- [ ] **Step 2: Add regression test** in `tests/lib/permissions/assert.test.ts`

```typescript
it('member:manage rejects target outside the family even when caller is owner', async () => {
  const { assertPermission } = await import('@/lib/permissions/assert');
  await expect(
    assertPermission(
      ctx.ownerId,
      'member:manage',
      { targetUserId: randomUUID() },
      { dataDir }
    )
  ).rejects.toThrow(/target_not_in_family/);
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test tests/lib/permissions/assert.test.ts`
Expected: previous count + 1.

- [ ] **Step 4: Commit**

```bash
git add lib/permissions/assert.ts tests/lib/permissions/assert.test.ts
git commit -m "feat(P2b): member:manage enforces target-in-same-family"
```

---

## Task 4: /api/family-members — list + create

**Files:**
- Create: `app/api/family-members/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { users, familyMembers } from '@/lib/db/schema';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';
import { createMember } from '@/lib/members/create';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(200),
  nickname: z.string().min(1).max(50),
  role: z.enum(['editor', 'viewer']) // owner is bootstrap-only
});

export const GET = withAuthorizedAction({ action: 'member:manage' })(async (_req, userId) => {
  const { db } = getDb({ dataDir });
  const caller = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!caller) return Response.json({ members: [] });

  const rows = db
    .select({
      memberId: familyMembers.id,
      userId: users.id,
      username: users.username,
      nickname: users.name,
      role: familyMembers.role,
      joinedAt: familyMembers.joinedAt
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, caller.familyId))
    .all();

  return Response.json({ members: rows });
});

export const POST = withAuthorizedAction({ action: 'member:manage' })(async (req, userId) => {
  let body: unknown;
  try { body = await req.json(); } catch { return jsonBadRequest('invalid_json'); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  const caller = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!caller) return jsonBadRequest('no_family');

  try {
    const result = await createMember({
      dataDir,
      familyId: caller.familyId,
      username: parsed.data.username,
      password: parsed.data.password,
      nickname: parsed.data.nickname,
      role: parsed.data.role
    });
    return Response.json(
      {
        memberId: result.memberId,
        userId: result.userId,
        username: parsed.data.username,
        nickname: parsed.data.nickname,
        role: parsed.data.role
      },
      { status: 201 }
    );
  } catch (e) {
    if ((e as Error).message === 'username_taken') {
      return Response.json({ error: 'username_taken' }, { status: 409 });
    }
    throw e;
  }
});
```

- [ ] **Step 2: Lint + commit**

```bash
pnpm lint app/api/family-members/route.ts
git add app/api/family-members/route.ts
git commit -m "feat(P2b): GET/POST /api/family-members (owner-only)"
```

---

## Task 5: /api/family-members/[id] — PATCH + DELETE

**Files:**
- Create: `app/api/family-members/[id]/route.ts`

PATCH supports role change and password reset. DELETE removes the `family_members` row only. Guards: cannot demote/delete owner via API.

- [ ] **Step 1: Write the route**

```typescript
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { users, familyMembers } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';
import { resetMemberPassword } from '@/lib/members/create';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

// The route id is a userId.
async function loadMember(id: string) {
  const { db } = getDb({ dataDir });
  const row = db
    .select({
      userId: users.id,
      username: users.username,
      nickname: users.name,
      memberId: familyMembers.id,
      familyId: familyMembers.familyId,
      role: familyMembers.role
    })
    .from(users)
    .innerJoin(familyMembers, eq(familyMembers.userId, users.id))
    .where(eq(users.id, id))
    .get();
  return row ?? null;
}

const patchSchema = z.object({
  role: z.enum(['editor', 'viewer']).optional(),
  password: z.string().min(8).max(200).optional()
}).refine((v) => v.role !== undefined || v.password !== undefined, {
  message: 'at_least_one_field_required'
});

export const PATCH = withAuthorizedResource({
  action: 'member:manage',
  loader: loadMember,
  getStatus: () => 'present',
  allowedStatuses: ['present'],
  toResource: (row) => ({ targetUserId: row.userId })
})(async (req, _ctx, row) => {
  if (row.role === 'owner') {
    return Response.json({ error: 'cannot_modify_owner_via_api' }, { status: 409 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return jsonBadRequest('invalid_json'); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  if (parsed.data.role) {
    db.update(familyMembers)
      .set({ role: parsed.data.role })
      .where(eq(familyMembers.id, row.memberId))
      .run();
    db.update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, row.userId))
      .run();
  }
  if (parsed.data.password) {
    resetMemberPassword({ dataDir, userId: row.userId, newPassword: parsed.data.password });
  }
  return Response.json({ updated: row.userId });
});

export const DELETE = withAuthorizedResource({
  action: 'member:manage',
  loader: loadMember,
  getStatus: () => 'present',
  allowedStatuses: ['present'],
  toResource: (row) => ({ targetUserId: row.userId })
})(async (_req, _ctx, row) => {
  if (row.role === 'owner') {
    return Response.json({ error: 'cannot_delete_owner' }, { status: 409 });
  }
  const { db } = getDb({ dataDir });
  // Delete family_members row only. users + accounts remain.
  // The removed user can still sign in but every protected endpoint will
  // return 404 (assertPermission throws not_family_member).
  db.delete(familyMembers).where(eq(familyMembers.id, row.memberId)).run();
  return Response.json({ removed: row.userId });
});
```

- [ ] **Step 2: Lint + commit**

```bash
pnpm lint app/api/family-members/\[id\]/route.ts
git add app/api/family-members/\[id\]/route.ts
git commit -m "feat(P2b): PATCH/DELETE /api/family-members/[id] (owner-immutable)"
```

---

## Task 6: /api/milestones — list + create

**Files:**
- Create: `app/api/milestones/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { eq, or, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { milestones, familyMembers } from '@/lib/db/schema';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const createSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(10),
  sortOrder: z.number().int().optional()
});

// GET — any family member can read (uses baby:read as the "you're a member" gate).
export const GET = withAuthorizedAction({ action: 'baby:read' })(async (_req, userId) => {
  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!member) return Response.json({ milestones: [] });

  const rows = db
    .select()
    .from(milestones)
    .where(or(isNull(milestones.familyId), eq(milestones.familyId, member.familyId)))
    .all();

  return Response.json({
    milestones: rows.map((m) => ({
      id: m.id,
      name: m.name,
      icon: m.icon,
      sortOrder: m.sortOrder,
      isSystem: m.familyId === null
    }))
  });
});

export const POST = withAuthorizedAction({ action: 'milestone:manage' })(async (req, userId) => {
  let body: unknown;
  try { body = await req.json(); } catch { return jsonBadRequest('invalid_json'); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest(parsed.error.issues.map((i) => i.message).join(';'));

  const { db } = getDb({ dataDir });
  const member = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!member) return jsonBadRequest('no_family');

  const id = randomUUID();
  db.insert(milestones)
    .values({
      id,
      familyId: member.familyId,
      name: parsed.data.name,
      icon: parsed.data.icon,
      sortOrder: parsed.data.sortOrder ?? 0,
      createdAt: Date.now()
    })
    .run();
  return Response.json({ id, name: parsed.data.name, icon: parsed.data.icon }, { status: 201 });
});
```

- [ ] **Step 2: Lint + commit**

```bash
pnpm lint app/api/milestones/route.ts
git add app/api/milestones/route.ts
git commit -m "feat(P2b): GET/POST /api/milestones (read=all members, write=owner)"
```

---

## Task 7: /api/milestones/[id] — PATCH + DELETE

**Files:**
- Create: `app/api/milestones/[id]/route.ts`

Owner-only. Cannot edit/delete system presets (familyId IS NULL).

- [ ] **Step 1: Write the route**

```typescript
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { milestones } from '@/lib/db/schema';
import { withAuthorizedResource } from '@/lib/permissions/route-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

async function loadMilestone(id: string) {
  const { db } = getDb({ dataDir });
  return db.select().from(milestones).where(eq(milestones.id, id)).get() ?? null;
}

const patchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().min(1).max(10).optional(),
  sortOrder: z.number().int().optional()
});

export const PATCH = withAuthorizedResource({
  action: 'milestone:manage',
  loader: loadMilestone,
  getStatus: () => 'present',
  allowedStatuses: ['present'],
  toResource: () => ({})
})(async (req, _ctx, row) => {
  if (row.familyId === null) {
    return Response.json({ error: 'cannot_modify_system_milestone' }, { status: 409 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return jsonBadRequest('invalid_json'); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('validation');

  const { db } = getDb({ dataDir });
  db.update(milestones)
    .set(parsed.data)
    .where(eq(milestones.id, row.id))
    .run();
  return Response.json({ updated: row.id });
});

export const DELETE = withAuthorizedResource({
  action: 'milestone:manage',
  loader: loadMilestone,
  getStatus: () => 'present',
  allowedStatuses: ['present'],
  toResource: () => ({})
})(async (_req, _ctx, row) => {
  if (row.familyId === null) {
    return Response.json({ error: 'cannot_delete_system_milestone' }, { status: 409 });
  }
  const { db } = getDb({ dataDir });
  // Hard delete; FK ON DELETE CASCADE on entry_milestones handles join rows
  db.delete(milestones).where(eq(milestones.id, row.id)).run();
  return Response.json({ deleted: row.id });
});
```

- [ ] **Step 2: Lint + commit**

```bash
pnpm lint app/api/milestones/\[id\]/route.ts
git add app/api/milestones/\[id\]/route.ts
git commit -m "feat(P2b): PATCH/DELETE /api/milestones/[id] (owner-only, system-immutable)"
```

---

## Task 8: Entry compose/edit accepts milestoneIds

**Files:**
- Modify: `app/api/entries/route.ts` (POST handler)
- Modify: `app/api/entries/[id]/route.ts` (PATCH + GET handlers)

- [ ] **Step 1: Update POST schema + handler in `app/api/entries/route.ts`**

Add `milestoneIds` to the create schema:

```typescript
const createSchema = z.object({
  babyId: z.string().regex(UUID_RE),
  content: z.string().min(1).max(10000),
  occurredAt: z.number().int().optional(),
  milestoneIds: z.array(z.string().regex(UUID_RE)).optional()
});
```

Inside the POST handler, after computing the new entry id but before the insert, validate milestoneIds:

```typescript
import { entryMilestones, milestones } from '@/lib/db/schema';
import { inArray, isNull, or, eq, and } from 'drizzle-orm';

let validMilestones: { id: string }[] = [];
if (parsed.data.milestoneIds && parsed.data.milestoneIds.length > 0) {
  // Find caller's family
  const callerMember = db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .get();
  if (!callerMember) return jsonNotFound();

  validMilestones = db
    .select({ id: milestones.id })
    .from(milestones)
    .where(
      and(
        inArray(milestones.id, parsed.data.milestoneIds),
        or(isNull(milestones.familyId), eq(milestones.familyId, callerMember.familyId))
      )
    )
    .all();
  if (validMilestones.length !== parsed.data.milestoneIds.length) {
    return jsonNotFound();
  }
}
```

Then wrap the insert + entry_milestones in a transaction:

```typescript
db.transaction((tx) => {
  tx.insert(entries).values({
    id, babyId: baby.id, authorId: userId, content: parsed.data.content,
    occurredAt, status: 'active', createdAt: now, updatedAt: now
  }).run();
  for (const m of validMilestones) {
    tx.insert(entryMilestones).values({ entryId: id, milestoneId: m.id }).run();
  }
});
```

- [ ] **Step 2: Update PATCH in `app/api/entries/[id]/route.ts`**

Add `milestoneIds` to patchSchema. In the handler:

```typescript
if (parsed.data.milestoneIds !== undefined) {
  // Validate per same rules as POST (look up caller's family via row.babyId → baby.familyId)
  const callerMember = db.select().from(familyMembers).where(eq(familyMembers.userId, /* userId */)).get();
  // ... reject 404 if any milestoneId doesn't validate ...
  db.transaction((tx) => {
    tx.delete(entryMilestones).where(eq(entryMilestones.entryId, row.id)).run();
    for (const m of validMilestones) {
      tx.insert(entryMilestones).values({ entryId: row.id, milestoneId: m.id }).run();
    }
  });
}
```

Note: `userId` is not in the wrapper handler signature. Get it via `getSessionUserId(req)` at the top of the handler.

- [ ] **Step 3: Update GET in `app/api/entries/[id]/route.ts` to surface attached milestones**

After fetching the entry row, query attached milestones:

```typescript
const attached = db
  .select({ id: milestones.id, name: milestones.name, icon: milestones.icon })
  .from(entryMilestones)
  .innerJoin(milestones, eq(milestones.id, entryMilestones.milestoneId))
  .where(eq(entryMilestones.entryId, row.id))
  .all();

return Response.json({
  id: row.id, babyId: row.babyId, authorId: row.authorId,
  content: row.content, occurredAt: row.occurredAt,
  createdAt: row.createdAt, updatedAt: row.updatedAt,
  milestones: attached
});
```

- [ ] **Step 4: Lint + commit**

```bash
pnpm lint app/api/entries/route.ts app/api/entries/\[id\]/route.ts
git add app/api/entries/route.ts app/api/entries/\[id\]/route.ts
git commit -m "feat(P2b): entries accept milestoneIds on POST + PATCH (replace strategy)"
```

---

## Task 9: Entry edit page

**Files:**
- Create: `app/entry/[id]/edit/page.tsx`
- Modify: `app/entry/[id]/page.tsx` (add edit link)

- [ ] **Step 1: Write `app/entry/[id]/edit/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface EntryDto {
  id: string;
  content: string;
  occurredAt: number;
  milestones?: { id: string; name: string; icon: string }[];
}

interface MilestoneDto {
  id: string;
  name: string;
  icon: string;
}

export default function EditEntryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<EntryDto | null>(null);
  const [allMilestones, setAllMilestones] = useState<MilestoneDto[]>([]);
  const [content, setContent] = useState('');
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const [eRes, mRes] = await Promise.all([
        fetch(`/api/entries/${params.id}`),
        fetch('/api/milestones')
      ]);
      if (!eRes.ok) { setError('记录不存在或无权限'); return; }
      const e: EntryDto = await eRes.json();
      const m: { milestones: MilestoneDto[] } = await mRes.json();
      setEntry(e);
      setContent(e.content);
      setSelectedMilestoneIds(new Set((e.milestones ?? []).map((x) => x.id)));
      setAllMilestones(m.milestones);
    })();
  }, [params.id]);

  function toggleMilestone(id: string) {
    setSelectedMilestoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit() {
    if (!entry) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content,
        milestoneIds: Array.from(selectedMilestoneIds)
      })
    });
    setPending(false);
    if (!res.ok) {
      setError(res.status === 404 ? '没有权限' : '保存失败');
      return;
    }
    router.push(`/entry/${entry.id}`);
    router.refresh();
  }

  if (!entry) return <main className="p-4">加载中…</main>;

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">编辑记录</h1>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        className="w-full border rounded px-3 py-2 resize-none mb-4"
      />
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">里程碑</p>
        <div className="flex flex-wrap gap-2">
          {allMilestones.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMilestone(m.id)}
              className={`px-3 py-1.5 text-sm border rounded ${
                selectedMilestoneIds.has(m.id) ? 'bg-black text-white' : ''
              }`}
            >
              {m.icon} {m.name}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
          取消
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update `app/entry/[id]/page.tsx`** — add edit link

In the existing detail page header, add a "编辑" link next to "← 时间线":

```tsx
<div className="flex gap-3 text-sm mb-2">
  <Link href={`/timeline?babyId=${entry.babyId}`} className="opacity-60">← 时间线</Link>
  <Link href={`/entry/${entry.id}/edit`} className="text-blue-600">编辑</Link>
</div>
```

Also surface attached milestones beneath the content if present:

```tsx
{entry.milestones && entry.milestones.length > 0 && (
  <div className="mt-4 flex flex-wrap gap-2">
    {entry.milestones.map((m: any) => (
      <span key={m.id} className="px-2 py-1 text-xs border rounded">
        {m.icon} {m.name}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/entry/\[id\]/
git commit -m "feat(P2b): entry edit page with milestone attachments + detail page chips"
```

---

## Task 10: Profile home page

**Files:**
- Create: `app/profile/page.tsx`
- Modify: `app/timeline/page.tsx` (add profile link)

- [ ] **Step 1: Write `app/profile/page.tsx`**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolve } from 'node:path';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db/client';
import { familyMembers, users } from '@/lib/db/schema';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

export default async function ProfilePage() {
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
  const me = db.select().from(users).where(eq(users.id, session.user.id)).get();

  const isOwner = member.role === 'owner';

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">{me?.name}</h1>
      <p className="text-sm opacity-60 mb-6">
        @{me?.username} · {member.role}
      </p>
      <nav className="flex flex-col gap-2">
        <Link href="/timeline" className="border rounded p-3 hover:bg-gray-50">
          ← 回到时间线
        </Link>
        {isOwner && (
          <>
            <Link href="/profile/babies" className="border rounded p-3 hover:bg-gray-50">
              宝宝管理
            </Link>
            <Link href="/profile/members" className="border rounded p-3 hover:bg-gray-50">
              成员管理
            </Link>
            <Link href="/profile/milestones" className="border rounded p-3 hover:bg-gray-50">
              里程碑设置
            </Link>
          </>
        )}
        {!isOwner && (
          <p className="text-sm opacity-60 px-3 py-2">
            其他设置仅 owner 可见
          </p>
        )}
      </nav>
    </main>
  );
}
```

- [ ] **Step 2: Modify timeline header** in `app/timeline/page.tsx` — add profile link beside "+ 新记录"

```tsx
<header className="flex items-center justify-between mb-4">
  <h1 className="text-xl font-semibold">时间线</h1>
  <div className="flex gap-2">
    <Link href="/profile" className="text-sm border rounded px-3 py-1.5">我</Link>
    <Link href={`/entry/new?babyId=${selectedBabyId}`} className="bg-black text-white text-sm rounded px-3 py-1.5">+ 新记录</Link>
  </div>
</header>
```

- [ ] **Step 3: Commit**

```bash
git add app/profile/page.tsx app/timeline/page.tsx
git commit -m "feat(P2b): profile home page + timeline header link"
```

---

## Task 11: /profile/babies — baby management

**Files:**
- Create: `app/profile/babies/page.tsx`

Lists active babies. Owner can rename, soft-delete, add new. (Restore/purge land in P4 trash bin page.)

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Baby {
  id: string;
  name: string;
  birthday: string;
  gender: string;
}

export default function BabiesAdminPage() {
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newBaby, setNewBaby] = useState({ name: '', birthday: '', gender: 'girl' });

  async function reload() {
    const res = await fetch('/api/babies');
    if (!res.ok) return;
    const body = await res.json();
    setBabies(body.babies);
  }
  useEffect(() => { reload(); }, []);

  async function rename(id: string) {
    await fetch(`/api/babies/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: editName })
    });
    setEditingId(null);
    reload();
  }

  async function trash(id: string) {
    if (!confirm('确定移到垃圾桶?')) return;
    await fetch(`/api/babies/${id}/trash`, { method: 'POST' });
    reload();
    router.refresh();
  }

  async function createBaby() {
    const res = await fetch('/api/babies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newBaby)
    });
    if (res.ok) {
      setCreating(false);
      setNewBaby({ name: '', birthday: '', gender: 'girl' });
      reload();
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm opacity-60">← 个人</Link>
      <h1 className="text-xl font-semibold my-4">宝宝管理</h1>

      <ul className="flex flex-col gap-3 mb-6">
        {babies.map((b) => (
          <li key={b.id} className="border rounded p-3 flex items-center justify-between">
            {editingId === b.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border rounded px-2 py-1 flex-1 mr-2"
                />
                <button onClick={() => rename(b.id)} className="text-sm bg-black text-white px-3 py-1 rounded mr-2">保存</button>
                <button onClick={() => setEditingId(null)} className="text-sm">取消</button>
              </>
            ) : (
              <>
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs opacity-60">{b.birthday} · {b.gender}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(b.id); setEditName(b.name); }} className="text-sm border rounded px-3 py-1">编辑</button>
                  <button onClick={() => trash(b.id)} className="text-sm text-red-600 border rounded px-3 py-1">删除</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="border rounded p-3 flex flex-col gap-2">
          <input placeholder="名字" value={newBaby.name} onChange={(e) => setNewBaby({ ...newBaby, name: e.target.value })} className="border rounded px-2 py-1" />
          <input type="date" value={newBaby.birthday} onChange={(e) => setNewBaby({ ...newBaby, birthday: e.target.value })} className="border rounded px-2 py-1" />
          <select value={newBaby.gender} onChange={(e) => setNewBaby({ ...newBaby, gender: e.target.value })} className="border rounded px-2 py-1">
            <option value="girl">女宝</option>
            <option value="boy">男宝</option>
            <option value="other">其他</option>
          </select>
          <div className="flex gap-2">
            <button onClick={createBaby} className="bg-black text-white text-sm px-3 py-1 rounded">创建</button>
            <button onClick={() => setCreating(false)} className="text-sm">取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="border rounded p-3 w-full text-left text-sm">+ 添加宝宝</button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/profile/babies/
git commit -m "feat(P2b): /profile/babies — list, create, rename, soft-delete"
```

---

## Task 12: /profile/members — member admin

**Files:**
- Create: `app/profile/members/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Member {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
}

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState({ username: '', password: '', nickname: '', role: 'editor' as 'editor' | 'viewer' });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch('/api/family-members');
    if (!res.ok) return;
    const body = await res.json();
    setMembers(body.members);
  }
  useEffect(() => { reload(); }, []);

  async function createNew() {
    setError(null);
    const res = await fetch('/api/family-members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newMember)
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error === 'username_taken' ? '用户名已被占用' : '创建失败');
      return;
    }
    setCreating(false);
    setNewMember({ username: '', password: '', nickname: '', role: 'editor' });
    reload();
  }

  async function changeRole(userId: string, role: 'editor' | 'viewer') {
    await fetch(`/api/family-members/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role })
    });
    reload();
  }

  async function remove(userId: string) {
    if (!confirm('确定移除该成员? 该成员将无法登录。')) return;
    await fetch(`/api/family-members/${userId}`, { method: 'DELETE' });
    reload();
  }

  async function resetPwd(userId: string) {
    if (!resetPassword || resetPassword.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    await fetch(`/api/family-members/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: resetPassword })
    });
    setResetFor(null);
    setResetPassword('');
    setError(null);
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm opacity-60">← 个人</Link>
      <h1 className="text-xl font-semibold my-4">成员管理</h1>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <ul className="flex flex-col gap-3 mb-6">
        {members.map((m) => (
          <li key={m.memberId} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{m.nickname}</p>
                <p className="text-xs opacity-60">@{m.username} · {m.role}</p>
              </div>
              {m.role !== 'owner' && (
                <div className="flex gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.userId, e.target.value as 'editor' | 'viewer')}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button onClick={() => setResetFor(m.userId)} className="text-sm border rounded px-3 py-1">改密码</button>
                  <button onClick={() => remove(m.userId)} className="text-sm text-red-600 border rounded px-3 py-1">移除</button>
                </div>
              )}
            </div>
            {resetFor === m.userId && (
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="新密码 (≥8 位)"
                  className="border rounded px-2 py-1 flex-1"
                />
                <button onClick={() => resetPwd(m.userId)} className="bg-black text-white text-sm px-3 py-1 rounded">保存</button>
                <button onClick={() => { setResetFor(null); setResetPassword(''); }} className="text-sm">取消</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="border rounded p-3 flex flex-col gap-2">
          <input placeholder="用户名 (3-50, a-z0-9_-)" value={newMember.username} onChange={(e) => setNewMember({ ...newMember, username: e.target.value })} className="border rounded px-2 py-1" />
          <input placeholder="昵称" value={newMember.nickname} onChange={(e) => setNewMember({ ...newMember, nickname: e.target.value })} className="border rounded px-2 py-1" />
          <input type="password" placeholder="初始密码 (≥8)" value={newMember.password} onChange={(e) => setNewMember({ ...newMember, password: e.target.value })} className="border rounded px-2 py-1" />
          <select value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value as 'editor' | 'viewer' })} className="border rounded px-2 py-1">
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <div className="flex gap-2">
            <button onClick={createNew} className="bg-black text-white text-sm px-3 py-1 rounded">创建</button>
            <button onClick={() => setCreating(false)} className="text-sm">取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="border rounded p-3 w-full text-left text-sm">+ 添加成员</button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/profile/members/
git commit -m "feat(P2b): /profile/members — list, create, role-change, password-reset, remove"
```

---

## Task 13: /profile/milestones — milestone admin

**Files:**
- Create: `app/profile/milestones/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Milestone {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  isSystem: boolean;
}

export default function MilestonesAdminPage() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', icon: '⭐' });

  async function reload() {
    const res = await fetch('/api/milestones');
    if (!res.ok) return;
    const body = await res.json();
    setItems(body.milestones);
  }
  useEffect(() => { reload(); }, []);

  async function create() {
    if (!draft.name || !draft.icon) return;
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft)
    });
    setCreating(false);
    setDraft({ name: '', icon: '⭐' });
    reload();
  }

  async function remove(id: string) {
    if (!confirm('确定删除? 已挂在记录上的会断开关联(不删记录)。')) return;
    await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <Link href="/profile" className="text-sm opacity-60">← 个人</Link>
      <h1 className="text-xl font-semibold my-4">里程碑设置</h1>

      <ul className="grid grid-cols-2 gap-2 mb-6">
        {items.map((m) => (
          <li key={m.id} className="border rounded p-3 flex items-center justify-between">
            <span>{m.icon} {m.name}{m.isSystem && <span className="text-xs opacity-50 ml-1">(系统)</span>}</span>
            {!m.isSystem && (
              <button onClick={() => remove(m.id)} className="text-xs text-red-600">×</button>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="border rounded p-3 flex flex-col gap-2">
          <input
            placeholder="emoji (如 🎉)"
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            className="border rounded px-2 py-1"
            maxLength={4}
          />
          <input
            placeholder="名称 (如 第一次叫妈妈)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <div className="flex gap-2">
            <button onClick={create} className="bg-black text-white text-sm px-3 py-1 rounded">创建</button>
            <button onClick={() => setCreating(false)} className="text-sm">取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="border rounded p-3 w-full text-left text-sm">+ 添加里程碑</button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/profile/milestones/
git commit -m "feat(P2b): /profile/milestones — list, create, delete"
```

---

## Task 14: E2E — member admin flow

**Files:**
- Create: `tests/e2e/members.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';

async function signInAs(request: any, email: string, password: string) {
  const res = await request.post('/api/auth/sign-in/email', { data: { email, password } });
  expect(res.status()).toBeLessThan(400);
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies.split(/,(?=\s*\w+=)/).map((c: string) => c.split(';')[0].trim()).join('; ');
}

test.describe.serial('member admin', () => {
  let ownerCookie: string;
  let newMemberUserId: string;

  test.beforeAll(async ({ request }) => {
    ownerCookie = await signInAs(request, 'e2eowner@local.babyloom', 'e2epassword');
  });

  test('owner creates an editor', async ({ request }) => {
    const res = await request.post('/api/family-members', {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { username: 'edith', password: 'edithpass123', nickname: 'Edith', role: 'editor' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.username).toBe('edith');
    newMemberUserId = body.userId;
  });

  test('new editor can sign in', async ({ request }) => {
    const cookie = await signInAs(request, 'edith@local.babyloom', 'edithpass123');
    const me = await request.get('/api/babies', { headers: { cookie } });
    expect(me.status()).toBe(200);
  });

  test('non-owner cannot list family members', async ({ request }) => {
    const cookie = await signInAs(request, 'edith@local.babyloom', 'edithpass123');
    const res = await request.get('/api/family-members', { headers: { cookie } });
    expect(res.status()).toBe(404);
  });

  test('owner resets password', async ({ request }) => {
    const res = await request.patch(`/api/family-members/${newMemberUserId}`, {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { password: 'edith-newpass-456' }
    });
    expect(res.status()).toBe(200);

    const oldAttempt = await request.post('/api/auth/sign-in/email', {
      data: { email: 'edith@local.babyloom', password: 'edithpass123' }
    });
    expect(oldAttempt.status()).toBeGreaterThanOrEqual(400);

    const newCookie = await signInAs(request, 'edith@local.babyloom', 'edith-newpass-456');
    expect(newCookie).toBeTruthy();
  });

  test('cannot change owner role via API', async ({ request }) => {
    const list = await request.get('/api/family-members', { headers: { cookie: ownerCookie } });
    const body = await list.json();
    const owner = body.members.find((m: any) => m.role === 'owner');
    const res = await request.patch(`/api/family-members/${owner.userId}`, {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { role: 'editor' }
    });
    expect(res.status()).toBe(409);
  });

  test('owner removes the editor', async ({ request }) => {
    const res = await request.delete(`/api/family-members/${newMemberUserId}`, {
      headers: { cookie: ownerCookie }
    });
    expect(res.status()).toBe(200);

    const cookie = await signInAs(request, 'edith@local.babyloom', 'edith-newpass-456');
    const blocked = await request.get('/api/babies', { headers: { cookie } });
    expect(blocked.status()).toBe(404);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm test:e2e tests/e2e/members.spec.ts
git add tests/e2e/members.spec.ts
git commit -m "test(P2b): E2E member admin (create, sign-in, password reset, remove)"
```

---

## Task 15: E2E — milestones + entry edit

**Files:**
- Create: `tests/e2e/milestones.spec.ts`
- Create: `tests/e2e/entry-edit.spec.ts`

- [ ] **Step 1: Milestones spec**

```typescript
import { test, expect } from '@playwright/test';

async function signInAsOwner(request: any) {
  const res = await request.post('/api/auth/sign-in/email', {
    data: { email: 'e2eowner@local.babyloom', password: 'e2epassword' }
  });
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies.split(/,(?=\s*\w+=)/).map((c: string) => c.split(';')[0].trim()).join('; ');
}

test.describe.serial('milestones', () => {
  let cookie: string;
  let milestoneId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
  });

  test('owner creates a custom milestone', async ({ request }) => {
    const res = await request.post('/api/milestones', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'First word', icon: '🗣️' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    milestoneId = body.id;
  });

  test('list returns the new milestone', async ({ request }) => {
    const res = await request.get('/api/milestones', { headers: { cookie } });
    const body = await res.json();
    expect(body.milestones.some((m: any) => m.id === milestoneId)).toBe(true);
  });

  test('owner deletes the milestone', async ({ request }) => {
    const res = await request.delete(`/api/milestones/${milestoneId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/milestones', { headers: { cookie } });
    const body = await list.json();
    expect(body.milestones.some((m: any) => m.id === milestoneId)).toBe(false);
  });
});
```

- [ ] **Step 2: Entry edit spec**

```typescript
import { test, expect } from '@playwright/test';

async function signInAsOwner(request: any) {
  const res = await request.post('/api/auth/sign-in/email', {
    data: { email: 'e2eowner@local.babyloom', password: 'e2epassword' }
  });
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies.split(/,(?=\s*\w+=)/).map((c: string) => c.split(';')[0].trim()).join('; ');
}

test.describe.serial('entry edit', () => {
  let cookie: string;
  let babyId: string;
  let entryId: string;
  let milestoneId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
    const babies = await (await request.get('/api/babies', { headers: { cookie } })).json();
    babyId = babies.babies[0].id;
    const ms = await request.post('/api/milestones', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'Test MS', icon: '✨' }
    });
    milestoneId = (await ms.json()).id;
    const entry = await request.post('/api/entries', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { babyId, content: 'original text' }
    });
    entryId = (await entry.json()).id;
  });

  test('PATCH changes content + attaches milestone', async ({ request }) => {
    const res = await request.patch(`/api/entries/${entryId}`, {
      headers: { cookie, 'content-type': 'application/json' },
      data: { content: 'updated text', milestoneIds: [milestoneId] }
    });
    expect(res.status()).toBe(200);

    const get = await (await request.get(`/api/entries/${entryId}`, { headers: { cookie } })).json();
    expect(get.content).toBe('updated text');
    expect(get.milestones?.some((m: any) => m.id === milestoneId)).toBe(true);
  });

  test('PATCH replaces milestones (empty array detaches all)', async ({ request }) => {
    const res = await request.patch(`/api/entries/${entryId}`, {
      headers: { cookie, 'content-type': 'application/json' },
      data: { milestoneIds: [] }
    });
    expect(res.status()).toBe(200);
    const get = await (await request.get(`/api/entries/${entryId}`, { headers: { cookie } })).json();
    expect(get.milestones?.length ?? 0).toBe(0);
  });

  test('PATCH with bogus milestoneId returns 404', async ({ request }) => {
    const res = await request.patch(`/api/entries/${entryId}`, {
      headers: { cookie, 'content-type': 'application/json' },
      data: { milestoneIds: ['00000000-0000-0000-0000-000000000000'] }
    });
    expect(res.status()).toBe(404);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test:e2e tests/e2e/milestones.spec.ts tests/e2e/entry-edit.spec.ts
git add tests/e2e/milestones.spec.ts tests/e2e/entry-edit.spec.ts
git commit -m "test(P2b): E2E milestones admin + entry edit + milestone attachment"
```

---

## P2b Acceptance Checklist

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` — P2a's 43 + 4 (createMember) + 2 (target-loaders milestones) + 1 (assert target_not_in_family) = **50 passing**
- [ ] `pnpm test:e2e` — P2a's 22 + members (6) + milestones (3) + entry-edit (3) = **34 passing**
- [ ] `pnpm lint` — 0 errors; all new `app/api/**/route.ts` files use `withAuthorizedAction` or `withAuthorizedResource` (verified by lint rule)
- [ ] Fresh boot → owner login → `/profile` lists "宝宝管理 / 成员管理 / 里程碑设置" links
- [ ] Owner visits `/profile/members` → creates editor → editor logs in successfully → editor visits `/profile/members` → gets 404 (no access)
- [ ] Owner creates milestone → entry compose shows it → save → entry detail surfaces the milestone chip
- [ ] Owner resets editor password → old password fails sign-in → new password succeeds
- [ ] Owner removes editor → editor's session cookie can still call `/api/auth/*` but `/api/babies` returns 404
- [ ] `DELETE /api/family-members/<ownerUserId>` → 409 (cannot delete owner)
- [ ] `PATCH /api/family-members/<ownerUserId>` with `role: 'editor'` → 409 (cannot demote owner via API)
- [ ] System-preset milestone (`familyId IS NULL`) — `DELETE` → 409 (`cannot_delete_system_milestone`)

## Notes for P3 onwards

- **P3** = media subsystem. `entry_media` join table is in place since P2a; P3 adds the `media` table, the upload pipeline (§6.2), the per-variant output (§6.3), the attach endpoint (§6.2.1), reconcile job, dedupe, MIME sniffing
- **P4** = trash bin UI. The soft-delete endpoints exist from P2a; P4 adds `/profile/trash` for browsing `status='trashed'` rows by resource type, restore + purge buttons, the 16-item parent-chain checklist enforcement codified as an ESLint rule
- **P5** = Animal Crossing design system + UI polish across all P2a/P2b pages
- **P6** = backup pipeline, Docker, deploy docs
