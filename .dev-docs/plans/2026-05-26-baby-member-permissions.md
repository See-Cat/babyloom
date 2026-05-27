# 成员-宝宝权限重设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把成员-宝宝权限从一维 `editor/viewer` 角色重构为"记录式"的多对多关联，UI 内联进成员管理页，并删除旧矩阵页。

**Architecture:** `role` 字段收敛为 `'owner' | 'member'`；非主理人对宝宝的访问完全由 `baby_member_permissions` 行决定（缺行 = 无权限）；旧"editor 只能动自己的"约束删除，"可编辑"含义扩展为该宝宝下所有内容全权限。

**Tech Stack:** Next.js 15 App Router / Drizzle (better-sqlite3) / Zod / React 19 / Tailwind / Vitest / Playwright

**Spec:** `docs/superpowers/specs/2026-05-26-baby-member-permissions-design.md`

---

## 影响文件总览

### 修改
- `lib/db/schema.ts` — role 注释收敛
- `lib/permissions/assert.ts` — 移除作者限制；strict 行存在检查
- `lib/permissions/route-template.ts` — role 类型 `'owner'|'member'`
- `lib/db/queries/permissions.ts` — 新增 list/batch 函数；listReadableBabies 改为 strict
- `lib/db/queries/trash.ts` — role 类型
- `lib/members/create.ts` — 可选 `babyAssociations` 原子写入
- `app/api/family-members/route.ts` — POST 扩展 / GET 附带 babyPermissions / Zod role
- `app/api/family-members/[id]/route.ts` — PATCH 删除 role 改档
- `app/profile/page.tsx` — 入口改名"成员管理"；删除"宝宝权限"；canUseTrash/canBulkUpload/RolePill 重写
- `app/profile/trash/page.tsx` + `TrashClient.tsx` — role 检查改造
- `app/profile/bulk-upload/page.tsx` — role 检查改造
- `app/profile/members/page.tsx` — 标题/检查无关变更（保持）
- `app/profile/members/MembersAdminClient.tsx` — 大改：标题、删除顶部 SegmentedControl、嵌入关联区块、删除"宝宝权限"链接、关联记录交互
- `app/entry/[id]/page.tsx` — role 检查改为查 baby_member_permissions
- `app/timeline/page.tsx`、`app/gallery/page.tsx`、`app/calendar/page.tsx` — role 类型
- `app/api/trash/route.ts` — allowRoles 改造（或改成断言）
- `components/features/FamilyMemberList.tsx` — 显示关联记录区与 "+ 关联宝宝"
- 多个测试文件

### 新增
- `app/api/family-members/[memberId]/baby-permissions/route.ts` — POST 批量
- `app/api/family-members/[memberId]/baby-permissions/[babyId]/route.ts` — PATCH/DELETE
- `components/features/BabyAssociationSheet.tsx` — 多选宝宝 + 全局权限
- 对应测试

### 删除
- `app/profile/members/permissions/page.tsx`
- `app/profile/members/permissions/actions.ts`

---

## 测试基础

项目使用 Vitest（`pnpm test`）+ Playwright（`pnpm test:e2e`）。Drizzle 集成测试使用 `tests/setup.ts` 提供的临时 SQLite。每个 API 任务都先写测试再写实现。

---

## Task 1: schema 注释收敛 + 权限引擎二元化

**Files:**
- Modify: `lib/db/schema.ts:22,88` — role 注释
- Modify: `lib/permissions/assert.ts` — 类型与逻辑
- Modify: `lib/permissions/route-template.ts:87,94,120` — 类型
- Modify: `lib/db/queries/trash.ts:10` — 类型
- Test: `tests/lib/permissions/assert.test.ts`（新增或扩展）

- [ ] **Step 1: 写失败测试 — 非主理人无关联行应被拒绝**

新建 `tests/lib/permissions/assert.member-strict.test.ts`（如已存在 assert.test.ts 则扩展之）：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDb } from '../../setup';
import { assertPermission } from '@/lib/permissions/assert';
import { ForbiddenError } from '@/lib/permissions/errors';
import { babies, families, familyMembers, users } from '@/lib/db/schema';

describe('assertPermission strict member rule', () => {
  let dataDir: string;
  let ownerUserId: string;
  let memberUserId: string;
  let babyId: string;

  beforeEach(async () => {
    const ctx = await createTestDb();
    dataDir = ctx.dataDir;
    const { db } = ctx;
    const familyId = randomUUID();
    ownerUserId = randomUUID();
    memberUserId = randomUUID();
    babyId = randomUUID();
    const now = new Date();
    db.insert(users).values([
      { id: ownerUserId, name: 'owner', email: 'o@x', emailVerified: true, username: 'owner', role: 'owner', createdAt: now, updatedAt: now },
      { id: memberUserId, name: 'm', email: 'm@x', emailVerified: true, username: 'm', role: 'member', createdAt: now, updatedAt: now }
    ]).run();
    db.insert(families).values({ id: familyId, name: 'F', ownerUserId, createdAt: Date.now(), updatedAt: Date.now() }).run();
    db.insert(familyMembers).values([
      { id: randomUUID(), familyId, userId: ownerUserId, role: 'owner', joinedAt: Date.now() },
      { id: randomUUID(), familyId, userId: memberUserId, role: 'member', joinedAt: Date.now() }
    ]).run();
    db.insert(babies).values({ id: babyId, familyId, name: 'B', birthday: '2024-01-01', gender: 'other', status: 'active', createdAt: Date.now(), updatedAt: Date.now() }).run();
  });

  it('rejects non-owner without baby_member_permissions row', async () => {
    await expect(
      assertPermission(memberUserId, 'baby:read', { babyId }, { dataDir })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows owner without override row', async () => {
    await expect(
      assertPermission(ownerUserId, 'baby:read', { babyId }, { dataDir })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
pnpm vitest run tests/lib/permissions/assert.member-strict.test.ts
```

期望：FAIL（`assertPermission` 当前对无 override 的 viewer/editor 角色会放行）

- [ ] **Step 3: 改 `lib/permissions/assert.ts` — 类型与逻辑**

替换 `EvaluateOptions.role`、`checkOwnershipMatrix` 的 role 形参、`assertPermission` 内的 `as 'owner' | 'editor' | 'viewer'`：

```ts
// EvaluateOptions
role: 'owner' | 'member';
```

`checkOwnershipMatrix` 函数体替换为（§9.1 简化版，无作者限制）：

```ts
function checkOwnershipMatrix(
  action: Action,
  role: 'owner' | 'member',
  _userId: string,
  _resource: PermissionResource | undefined
): void {
  if (role === 'owner') return;
  // owner-only 已被前置 OWNER_ONLY_ACTIONS 拒绝
  // 其余 read/write/trash/restore 操作完全由 baby_member_permissions 的 bit 决定
  // 此函数无需再做额外检查
}
```

`assertPermission` 内：

```ts
const role = member.role === 'owner' ? 'owner' : 'member';
```

**关键改动**：在 §3 override 段落后追加 strict 检查：

```ts
// strict: 非主理人对 baby-scoped 动作必须有对应 baby_member_permissions 行
if (role !== 'owner' && bit && resource?.babyId && !override) {
  throw new ForbiddenError(action, 'no_baby_permission_row');
}
```

把 §3 注释里"override is opt-in"那一句改为"对非主理人是必需的"。

`evaluate()` 内：把 `if (bit && opts.ownership?.babyId && opts.override && opts.override[bit] !== 1)` 的 override 缺失也算拒绝（但 assertPermission 已早一步拒绝；evaluate 保险起见再判）：

```ts
if (bit && opts.ownership?.babyId && opts.role !== 'owner') {
  if (!opts.override) return { allow: false, reason: 'no_baby_permission_row' };
  if (opts.override[bit] !== 1) return { allow: false, reason: `baby_perm_${bit}_denied` };
}
```

- [ ] **Step 4: 改 `lib/permissions/route-template.ts`**

把 `allowRoles?: ReadonlyArray<'owner' | 'editor' | 'viewer'>` 改为 `ReadonlyArray<'owner' | 'member'>`；`ctx.role` 同步；`member.role as 'owner' | 'editor' | 'viewer'` 改为 `member.role === 'owner' ? 'owner' : 'member'`。

- [ ] **Step 5: 改 `lib/db/queries/trash.ts:10`**

`role: 'owner' | 'editor' | 'viewer'` → `role: 'owner' | 'member'`。函数体里 `viewer.role === 'owner'` 不变；其它分支只有 owner 与 member 两态。

- [ ] **Step 6: 改 schema 注释（不动 DDL）**

`lib/db/schema.ts:22`：
```ts
role: text('role').notNull() // 'owner' | 'member'
```

`lib/db/schema.ts:88`：
```ts
role: text('role').notNull(), // 'owner' | 'member'
```

- [ ] **Step 7: 跑测试确认通过**

```bash
pnpm vitest run tests/lib/permissions/assert.member-strict.test.ts
```

期望：PASS（2 tests）。

- [ ] **Step 8: 跑全部 assert 测试，确认未破坏**

```bash
pnpm vitest run tests/lib/permissions/
```

期望：旧测试中针对"editor 只能改自己的"那批用例会失败，记录失败列表。

- [ ] **Step 9: 更新旧测试 — 移除"作者限制"用例，新增"member 全权限"用例**

针对失败用例，逐个修改：
- "editor 不能改别人的 entry" → 删除（不再适用）
- "viewer 不能 write" → 改为 "member 无 canWrite 行不能 write"
- 增加 "member 有 canWrite=1 可以改别人的 entry"

具体替换由实施时按报错列表逐条改。

- [ ] **Step 10: 跑测试确认全绿**

```bash
pnpm vitest run tests/lib/permissions/
```

- [ ] **Step 11: 提交**

```bash
git add lib/permissions/assert.ts lib/permissions/route-template.ts lib/db/queries/trash.ts lib/db/schema.ts tests/lib/permissions/
git commit -m "refactor(permissions): collapse role to owner|member; strict per-baby row required"
```

---

## Task 2: queries/permissions.ts — 新增 list 与 batch helper

**Files:**
- Modify: `lib/db/queries/permissions.ts`
- Test: `tests/lib/db/queries/permissions.test.ts`（如不存在则新建）

- [ ] **Step 1: 写失败测试**

`tests/lib/db/queries/permissions.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDb } from '../../../setup';
import {
  listMemberBabyPermissions,
  batchUpsertMemberPermissions,
  clearPermissionRow,
  listReadableBabies
} from '@/lib/db/queries/permissions';
import { babies, families, familyMembers, users } from '@/lib/db/schema';

async function seed() {
  const ctx = await createTestDb();
  const { db } = ctx;
  const familyId = randomUUID();
  const ownerUserId = randomUUID();
  const memberUserId = randomUUID();
  const memberId = randomUUID();
  const babyAId = randomUUID();
  const babyBId = randomUUID();
  const now = new Date();
  db.insert(users).values([
    { id: ownerUserId, name: 'o', email: 'o@x', emailVerified: true, username: 'o', role: 'owner', createdAt: now, updatedAt: now },
    { id: memberUserId, name: 'm', email: 'm@x', emailVerified: true, username: 'm', role: 'member', createdAt: now, updatedAt: now }
  ]).run();
  db.insert(families).values({ id: familyId, name: 'F', ownerUserId, createdAt: Date.now(), updatedAt: Date.now() }).run();
  db.insert(familyMembers).values([
    { id: randomUUID(), familyId, userId: ownerUserId, role: 'owner', joinedAt: Date.now() },
    { id: memberId, familyId, userId: memberUserId, role: 'member', joinedAt: Date.now() }
  ]).run();
  db.insert(babies).values([
    { id: babyAId, familyId, name: 'A', birthday: '2024-01-01', gender: 'other', status: 'active', createdAt: Date.now(), updatedAt: Date.now() },
    { id: babyBId, familyId, name: 'B', birthday: '2024-01-01', gender: 'other', status: 'active', createdAt: Date.now() + 1, updatedAt: Date.now() }
  ]).run();
  return { db, ctx, familyId, memberId, memberUserId, babyAId, babyBId };
}

describe('listMemberBabyPermissions', () => {
  it('returns empty array when no rows', async () => {
    const { db, memberId } = await seed();
    expect(listMemberBabyPermissions({ db, familyMemberId: memberId })).toEqual([]);
  });

  it('returns rows for active babies with permission label', async () => {
    const { db, memberId, babyAId, babyBId } = await seed();
    batchUpsertMemberPermissions({ db, familyMemberId: memberId, babyIds: [babyAId, babyBId], permission: 'editor' });
    const rows = listMemberBabyPermissions({ db, familyMemberId: memberId });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.permission === 'editor')).toBe(true);
  });

  it('omits trashed babies', async () => {
    const { db, memberId, babyAId, babyBId } = await seed();
    batchUpsertMemberPermissions({ db, familyMemberId: memberId, babyIds: [babyAId, babyBId], permission: 'viewer' });
    db.update(babies).set({ status: 'trashed' }).where(eq(babies.id, babyBId)).run();
    const rows = listMemberBabyPermissions({ db, familyMemberId: memberId });
    expect(rows.map((r) => r.babyId)).toEqual([babyAId]);
  });
});

describe('batchUpsertMemberPermissions', () => {
  it('writes new rows', async () => {
    const { db, memberId, babyAId } = await seed();
    batchUpsertMemberPermissions({ db, familyMemberId: memberId, babyIds: [babyAId], permission: 'viewer' });
    const rows = listMemberBabyPermissions({ db, familyMemberId: memberId });
    expect(rows[0]).toMatchObject({ babyId: babyAId, permission: 'viewer' });
  });

  it('overwrites existing row', async () => {
    const { db, memberId, babyAId } = await seed();
    batchUpsertMemberPermissions({ db, familyMemberId: memberId, babyIds: [babyAId], permission: 'viewer' });
    batchUpsertMemberPermissions({ db, familyMemberId: memberId, babyIds: [babyAId], permission: 'editor' });
    const rows = listMemberBabyPermissions({ db, familyMemberId: memberId });
    expect(rows).toHaveLength(1);
    expect(rows[0].permission).toBe('editor');
  });
});

describe('listReadableBabies strict', () => {
  it('returns empty for member without any permission rows', async () => {
    const { db, ctx, memberId, memberUserId } = await seed();
    const out = listReadableBabies({
      db,
      familyId: ctx.familyId ?? '',
      familyMemberId: memberId,
      role: 'member',
      userId: memberUserId
    });
    expect(out).toEqual([]);
  });
});
```

记得 import `eq from 'drizzle-orm'`。

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run tests/lib/db/queries/permissions.test.ts
```

期望：FAIL（新函数不存在；`listReadableBabies` 当前还会经 evaluate 回落）。

- [ ] **Step 3: 改 `lib/db/queries/permissions.ts`**

在文件中新增：

```ts
export type Permission = 'viewer' | 'editor';

export function permissionToBits(p: Permission): PermissionBits {
  return p === 'editor'
    ? { canRead: 1, canWrite: 1, canDelete: 1 }
    : { canRead: 1, canWrite: 0, canDelete: 0 };
}

export function bitsToPermission(bits: PermissionBits): Permission {
  if (bits.canWrite === 1 && bits.canDelete === 1) return 'editor';
  return 'viewer';
}

export interface MemberBabyPermissionRow {
  babyId: string;
  babyName: string;
  babyAvatarUrl: string | null;
  permission: Permission;
}

export function listMemberBabyPermissions(opts: {
  db: Db;
  familyMemberId: string;
}): MemberBabyPermissionRow[] {
  const rows = opts.db
    .select({
      babyId: babies.id,
      babyName: babies.name,
      babyAvatarUrl: babies.avatarUrl,
      canRead: babyMemberPermissions.canRead,
      canWrite: babyMemberPermissions.canWrite,
      canDelete: babyMemberPermissions.canDelete,
      createdAt: babies.createdAt
    })
    .from(babyMemberPermissions)
    .innerJoin(babies, eq(babies.id, babyMemberPermissions.babyId))
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, opts.familyMemberId),
        eq(babies.status, 'active')
      )
    )
    .orderBy(babies.createdAt)
    .all();
  return rows.map((r) => ({
    babyId: r.babyId,
    babyName: r.babyName,
    babyAvatarUrl: r.babyAvatarUrl,
    permission: bitsToPermission({ canRead: r.canRead, canWrite: r.canWrite, canDelete: r.canDelete })
  }));
}

export function batchUpsertMemberPermissions(opts: {
  db: Db;
  familyMemberId: string;
  babyIds: string[];
  permission: Permission;
}): void {
  const bits = permissionToBits(opts.permission);
  opts.db.transaction((tx) => {
    for (const babyId of opts.babyIds) {
      tx.insert(babyMemberPermissions)
        .values({
          id: randomUUID(),
          familyMemberId: opts.familyMemberId,
          babyId,
          canRead: bits.canRead,
          canWrite: bits.canWrite,
          canDelete: bits.canDelete
        })
        .onConflictDoUpdate({
          target: [babyMemberPermissions.babyId, babyMemberPermissions.familyMemberId],
          set: bits
        })
        .run();
    }
  });
}
```

修改 `listReadableBabies`：当 role !== 'owner' 时，**只**返回有 `canRead=1` 行的宝宝（无行 = 不可见）：

```ts
export function listReadableBabies(opts: {
  db: Db;
  familyId: string;
  familyMemberId: string;
  role: 'owner' | 'member';
  userId: string;
}) {
  const activeBabies = opts.db
    .select()
    .from(babies)
    .where(and(eq(babies.familyId, opts.familyId), eq(babies.status, 'active')))
    .orderBy(babies.createdAt)
    .all();
  if (opts.role === 'owner' || activeBabies.length === 0) return activeBabies;

  const overrides = opts.db
    .select()
    .from(babyMemberPermissions)
    .where(
      and(
        eq(babyMemberPermissions.familyMemberId, opts.familyMemberId),
        inArray(
          babyMemberPermissions.babyId,
          activeBabies.map((baby) => baby.id)
        )
      )
    )
    .all();
  const readableIds = new Set(
    overrides.filter((o) => o.canRead === 1).map((o) => o.babyId)
  );
  return activeBabies.filter((baby) => readableIds.has(baby.id));
}
```

同步把 `PermissionMatrixRow.member.role` 类型从 `'editor' | 'viewer'` 改为 `'member'`（旧 listPermissions 即将随矩阵页一并被删除，保留是过渡用）。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run tests/lib/db/queries/permissions.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add lib/db/queries/permissions.ts tests/lib/db/queries/permissions.test.ts
git commit -m "feat(permissions): add list+batch helpers; listReadableBabies strict for member"
```

---

## Task 3: createMember 扩展支持 atomic baby associations

**Files:**
- Modify: `lib/members/create.ts`
- Test: `tests/lib/members/create.test.ts`

- [ ] **Step 1: 写失败测试**

在现有 `create.test.ts` 末尾追加：

```ts
import { batchUpsertMemberPermissions, listMemberBabyPermissions } from '@/lib/db/queries/permissions';

it('atomically writes baby associations when provided', async () => {
  const ctx = await createTestDb();
  // ... seed family + 2 active babies (babyA, babyB)
  const result = await createMember({
    dataDir: ctx.dataDir,
    familyId,
    username: 'grandpa',
    password: 'pw12345678',
    nickname: 'Grandpa',
    role: 'member',
    babyAssociations: { babyIds: [babyAId, babyBId], permission: 'editor' }
  });
  const { db } = getDb({ dataDir: ctx.dataDir });
  const rows = listMemberBabyPermissions({ db, familyMemberId: result.memberId });
  expect(rows).toHaveLength(2);
  expect(rows.every((r) => r.permission === 'editor')).toBe(true);
});

it('rolls back account creation when association write fails', async () => {
  const ctx = await createTestDb();
  // seed family but pass a non-existent babyId — expect throw + no user row
  await expect(
    createMember({
      dataDir: ctx.dataDir,
      familyId,
      username: 'will-fail',
      password: 'pw12345678',
      nickname: 'X',
      role: 'member',
      babyAssociations: { babyIds: ['00000000-0000-0000-0000-000000000000'], permission: 'viewer' }
    })
  ).rejects.toThrow();
  const { db } = getDb({ dataDir: ctx.dataDir });
  const u = db.select().from(users).where(eq(users.username, 'will-fail')).get();
  expect(u).toBeUndefined();
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
pnpm vitest run tests/lib/members/create.test.ts
```

- [ ] **Step 3: 改 `lib/members/create.ts`**

替换 `CreateMemberOpts` 与 `createMember`：

```ts
export interface CreateMemberOpts {
  dataDir: string;
  familyId: string;
  username: string;
  password: string;
  nickname: string;
  role: 'owner' | 'member';
  babyAssociations?: {
    babyIds: string[];
    permission: 'viewer' | 'editor';
  };
}
```

在 transaction 内追加（在 family_members insert 之后）：

```ts
if (opts.babyAssociations && opts.babyAssociations.babyIds.length > 0) {
  const bits = permissionToBits(opts.babyAssociations.permission);
  // 校验所有 babyId 属于该 family 且 status=active
  const owned = tx
    .select({ id: babies.id })
    .from(babies)
    .where(
      and(
        eq(babies.familyId, opts.familyId),
        eq(babies.status, 'active'),
        inArray(babies.id, opts.babyAssociations.babyIds)
      )
    )
    .all();
  if (owned.length !== opts.babyAssociations.babyIds.length) {
    throw new Error('invalid_baby_id');
  }
  for (const babyId of opts.babyAssociations.babyIds) {
    tx.insert(babyMemberPermissions).values({
      id: randomUUID(),
      familyMemberId: memberId,
      babyId,
      canRead: bits.canRead,
      canWrite: bits.canWrite,
      canDelete: bits.canDelete
    }).run();
  }
}
```

import：`babies, babyMemberPermissions` from schema；`permissionToBits` from queries/permissions；`inArray` from drizzle-orm。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run tests/lib/members/create.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add lib/members/create.ts tests/lib/members/create.test.ts
git commit -m "feat(members): atomic baby associations on member create"
```

---

## Task 4: 新增 API — POST /api/family-members/[memberId]/baby-permissions

**Files:**
- Create: `app/api/family-members/[memberId]/baby-permissions/route.ts`
- Test: `tests/integration/api/baby-permissions-batch.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setupApiTest, asOwner, asMember } from '../../fixtures/api';

describe('POST /api/family-members/:memberId/baby-permissions', () => {
  let ctx: Awaited<ReturnType<typeof setupApiTest>>;
  beforeEach(async () => { ctx = await setupApiTest(); });

  it('owner can batch-add associations', async () => {
    const res = await ctx.fetch(`/api/family-members/${ctx.memberId}/baby-permissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: asOwner(ctx) },
      body: JSON.stringify({ babyIds: [ctx.babyAId, ctx.babyBId], permission: 'editor' })
    });
    expect(res.status).toBe(201);
  });

  it('non-owner gets 403', async () => {
    const res = await ctx.fetch(`/api/family-members/${ctx.memberId}/baby-permissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: asMember(ctx) },
      body: JSON.stringify({ babyIds: [ctx.babyAId], permission: 'viewer' })
    });
    expect(res.status).toBe(403);
  });

  it('400 on invalid permission', async () => {
    const res = await ctx.fetch(`/api/family-members/${ctx.memberId}/baby-permissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: asOwner(ctx) },
      body: JSON.stringify({ babyIds: [ctx.babyAId], permission: 'admin' })
    });
    expect(res.status).toBe(400);
  });

  it('400 when target is owner', async () => {
    const res = await ctx.fetch(`/api/family-members/${ctx.ownerMemberId}/baby-permissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: asOwner(ctx) },
      body: JSON.stringify({ babyIds: [ctx.babyAId], permission: 'editor' })
    });
    expect(res.status).toBe(400);
  });

  it('400 when babyId not active or cross-family', async () => {
    // ...
  });
});
```

> 注：如果 `tests/integration/api/fixtures.ts` (`setupApiTest`, `asOwner` 等) 尚不存在，先看其他 integration 测试用例（如 `tests/integration/api/family-members.test.ts` 如果存在）复用其辅助；不存在则先建一个最小 fixture。仅在确实需要时建。

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run tests/integration/api/baby-permissions-batch.test.ts
```

- [ ] **Step 3: 创建路由**

`app/api/family-members/[memberId]/baby-permissions/route.ts`：

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babies, familyMembers } from '@/lib/db/schema';
import { batchUpsertMemberPermissions } from '@/lib/db/queries/permissions';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const bodySchema = z.object({
  babyIds: z.array(z.string().uuid()).min(1).max(50),
  permission: z.enum(['viewer', 'editor'])
});

export const POST = withAuthorizedAction({ action: 'member:manage' })(async (req, userId, ctx) => {
  const { memberId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return jsonBadRequest('invalid_json'); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('invalid_request');

  const { db } = getDb({ dataDir });
  const caller = db.select().from(familyMembers).where(eq(familyMembers.userId, userId)).get();
  if (!caller) return jsonBadRequest('no_family');

  const target = db
    .select({ id: familyMembers.id, role: familyMembers.role, familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.id, memberId))
    .get();
  if (!target || target.familyId !== caller.familyId) return jsonBadRequest('invalid_request');
  if (target.role === 'owner') return jsonBadRequest('invalid_request');

  // 校验所有 babyId 属于本 family 且 active
  const valid = db
    .select({ id: babies.id })
    .from(babies)
    .where(
      and(
        eq(babies.familyId, caller.familyId),
        eq(babies.status, 'active'),
        inArray(babies.id, parsed.data.babyIds)
      )
    )
    .all();
  if (valid.length !== parsed.data.babyIds.length) return jsonBadRequest('invalid_request');

  batchUpsertMemberPermissions({
    db,
    familyMemberId: memberId,
    babyIds: parsed.data.babyIds,
    permission: parsed.data.permission
  });

  return Response.json({ ok: true }, { status: 201 });
});
```

Next.js 15 的 ctx.params 是 Promise — 注意 `await`。

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 提交**

```bash
git add app/api/family-members/[memberId]/baby-permissions/route.ts tests/integration/api/baby-permissions-batch.test.ts
git commit -m "feat(api): POST batch baby-permissions endpoint"
```

---

## Task 5: 新增 API — PATCH/DELETE /api/family-members/[memberId]/baby-permissions/[babyId]

**Files:**
- Create: `app/api/family-members/[memberId]/baby-permissions/[babyId]/route.ts`
- Test: `tests/integration/api/baby-permissions-single.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
describe('PATCH /api/family-members/:memberId/baby-permissions/:babyId', () => {
  // 测：成功改档；不存在的行 → 404；非主理人 → 403；invalid permission → 400
});
describe('DELETE /api/family-members/:memberId/baby-permissions/:babyId', () => {
  // 测：成功删行；删后再删 → 404 或 idempotent 200（选 idempotent 200 更友好）
});
```

具体用例参考 Task 4 的风格补全。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 创建路由**

`app/api/family-members/[memberId]/baby-permissions/[babyId]/route.ts`：

```ts
import { and, eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { babyMemberPermissions, familyMembers } from '@/lib/db/schema';
import { batchUpsertMemberPermissions, clearPermissionRow } from '@/lib/db/queries/permissions';
import { withAuthorizedAction } from '@/lib/permissions/action-template';
import { jsonBadRequest } from '@/lib/permissions/responses';

const dataDir = process.env.BABYLOOM_DATA_DIR
  ? resolve(process.env.BABYLOOM_DATA_DIR)
  : resolve(process.cwd(), 'data');

const patchSchema = z.object({ permission: z.enum(['viewer', 'editor']) });

async function loadAndCheck(userId: string, memberId: string) {
  const { db } = getDb({ dataDir });
  const caller = db.select().from(familyMembers).where(eq(familyMembers.userId, userId)).get();
  if (!caller) return { error: 'no_family' as const };
  const target = db
    .select({ id: familyMembers.id, role: familyMembers.role, familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.id, memberId))
    .get();
  if (!target || target.familyId !== caller.familyId) return { error: 'invalid_request' as const };
  if (target.role === 'owner') return { error: 'invalid_request' as const };
  return { db, caller, target };
}

export const PATCH = withAuthorizedAction({ action: 'member:manage' })(async (req, userId, ctx) => {
  const { memberId, babyId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return jsonBadRequest('invalid_json'); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonBadRequest('invalid_request');

  const checked = await loadAndCheck(userId, memberId);
  if ('error' in checked) return jsonBadRequest(checked.error);

  // 必须已有行
  const existing = checked.db
    .select()
    .from(babyMemberPermissions)
    .where(and(
      eq(babyMemberPermissions.familyMemberId, memberId),
      eq(babyMemberPermissions.babyId, babyId)
    ))
    .get();
  if (!existing) return Response.json({ error: 'not_found' }, { status: 404 });

  batchUpsertMemberPermissions({
    db: checked.db,
    familyMemberId: memberId,
    babyIds: [babyId],
    permission: parsed.data.permission
  });
  return Response.json({ ok: true });
});

export const DELETE = withAuthorizedAction({ action: 'member:manage' })(async (_req, userId, ctx) => {
  const { memberId, babyId } = await ctx.params;
  const checked = await loadAndCheck(userId, memberId);
  if ('error' in checked) return jsonBadRequest(checked.error);
  clearPermissionRow({ db: checked.db, familyMemberId: memberId, babyId });
  return Response.json({ ok: true });
});
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 提交**

```bash
git add app/api/family-members/[memberId]/baby-permissions/[babyId]/route.ts tests/integration/api/baby-permissions-single.test.ts
git commit -m "feat(api): PATCH/DELETE single baby-permission endpoints"
```

---

## Task 6: POST /api/family-members 扩展 + GET 返回 babyPermissions

**Files:**
- Modify: `app/api/family-members/route.ts`
- Test: `tests/integration/api/family-members-extended.test.ts`（新建或扩展现有）

- [ ] **Step 1: 写失败测试**

```ts
it('POST creates member with baby associations atomically', async () => {
  const res = await ctx.fetch('/api/family-members', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: asOwner(ctx) },
    body: JSON.stringify({
      username: 'auntie',
      password: 'pw12345678',
      nickname: 'Auntie',
      babyAssociations: { babyIds: [ctx.babyAId], permission: 'editor' }
    })
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.memberId).toBeDefined();
  // verify GET includes the new member's baby permissions
  const list = await ctx.fetch('/api/family-members', { headers: { cookie: asOwner(ctx) } });
  const json = await list.json();
  const newMember = json.members.find((m: any) => m.username === 'auntie');
  expect(newMember.babyPermissions).toEqual([
    expect.objectContaining({ babyId: ctx.babyAId, permission: 'editor' })
  ]);
});

it('POST without babyAssociations creates account only', async () => {
  // ...
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 改 `app/api/family-members/route.ts`**

修改 `createSchema`（移除 `role`，添加可选 `babyAssociations`）：

```ts
const createSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(200),
  nickname: z.string().min(1).max(50),
  babyAssociations: z
    .object({
      babyIds: z.array(z.string().uuid()).min(1).max(50),
      permission: z.enum(['viewer', 'editor'])
    })
    .optional()
});
```

POST 内调用 createMember 时：

```ts
const result = await createMember({
  dataDir,
  familyId: caller.familyId,
  username: parsed.data.username,
  password: parsed.data.password,
  nickname: parsed.data.nickname,
  role: 'member',
  babyAssociations: parsed.data.babyAssociations
});
return Response.json({
  memberId: result.memberId,
  userId: result.userId,
  username: parsed.data.username,
  nickname: parsed.data.nickname
}, { status: 201 });
```

修改 GET — 为每个 member 附带 babyPermissions：

```ts
const rows = db.select({...}).from(familyMembers).innerJoin(...)...all();

const memberIds = rows.filter((r) => r.role !== 'owner').map((r) => r.memberId);
const perms = memberIds.length === 0 ? [] : db
  .select({
    familyMemberId: babyMemberPermissions.familyMemberId,
    babyId: babies.id,
    babyName: babies.name,
    babyAvatarUrl: babies.avatarUrl,
    canRead: babyMemberPermissions.canRead,
    canWrite: babyMemberPermissions.canWrite,
    canDelete: babyMemberPermissions.canDelete
  })
  .from(babyMemberPermissions)
  .innerJoin(babies, eq(babies.id, babyMemberPermissions.babyId))
  .where(and(
    inArray(babyMemberPermissions.familyMemberId, memberIds),
    eq(babies.status, 'active')
  ))
  .all();

const byMember = new Map<string, MemberBabyPermissionRow[]>();
for (const p of perms) {
  const list = byMember.get(p.familyMemberId) ?? [];
  list.push({
    babyId: p.babyId,
    babyName: p.babyName,
    babyAvatarUrl: p.babyAvatarUrl,
    permission: bitsToPermission({ canRead: p.canRead, canWrite: p.canWrite, canDelete: p.canDelete })
  });
  byMember.set(p.familyMemberId, list);
}

return Response.json({
  members: rows.map((r) => ({
    ...r,
    babyPermissions: byMember.get(r.memberId) ?? []
  }))
});
```

import `bitsToPermission, MemberBabyPermissionRow`、`babies, babyMemberPermissions`、`inArray`。

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 提交**

```bash
git add app/api/family-members/route.ts tests/integration/api/family-members-extended.test.ts
git commit -m "feat(api): POST atomic babyAssociations; GET returns babyPermissions per member"
```

---

## Task 7: PATCH /api/family-members/[id] 删除 role 改档

**Files:**
- Modify: `app/api/family-members/[id]/route.ts`
- Test: `tests/integration/api/family-members-extended.test.ts`（追加）

- [ ] **Step 1: 写测试**

```ts
it('PATCH no longer accepts role; password still works', async () => {
  const res = await ctx.fetch(`/api/family-members/${ctx.memberUserId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: asOwner(ctx) },
    body: JSON.stringify({ role: 'editor' })
  });
  expect(res.status).toBe(400); // role field no longer recognized

  const pw = await ctx.fetch(`/api/family-members/${ctx.memberUserId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: asOwner(ctx) },
    body: JSON.stringify({ password: 'newpassword' })
  });
  expect(pw.status).toBe(200);
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 改 `app/api/family-members/[id]/route.ts`**

`patchSchema` 改为：

```ts
const patchSchema = z.object({
  password: z.string().min(8).max(200)
});
```

PATCH handler 体内移除 role 分支：

```ts
const parsed = patchSchema.safeParse(body);
if (!parsed.success) return jsonBadRequest('invalid_request');

resetMemberPassword({ dataDir, userId: row.userId, newPassword: parsed.data.password });
return Response.json({ updated: row.userId });
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 提交**

```bash
git add app/api/family-members/[id]/route.ts tests/integration/api/family-members-extended.test.ts
git commit -m "refactor(api): PATCH family-members no longer accepts role"
```

---

## Task 8: FamilyMemberList 改造 — 渲染关联记录 + "+ 关联宝宝"

**Files:**
- Modify: `components/features/FamilyMemberList.tsx`
- Modify: `components/features/FamilyMemberList.test.tsx`

- [ ] **Step 1: 写失败测试（追加用例）**

```ts
import { render, screen } from '@testing-library/react';
import { FamilyMemberList } from './FamilyMemberList';

it('renders baby permission rows under member', () => {
  render(
    <FamilyMemberList
      members={[
        {
          memberId: 'm1', userId: 'u1', username: 'grandpa', nickname: 'Grandpa', role: 'member',
          babyPermissions: [
            { babyId: 'b1', babyName: 'Big Bro', babyAvatarUrl: null, permission: 'editor' },
            { babyId: 'b2', babyName: 'Sis', babyAvatarUrl: null, permission: 'viewer' }
          ]
        }
      ]}
      onMemberAction={() => {}}
      onAssociationClick={() => {}}
      onAddAssociation={() => {}}
    />
  );
  expect(screen.getByText('Big Bro')).toBeInTheDocument();
  expect(screen.getByText('Sis')).toBeInTheDocument();
  expect(screen.getByText('可编辑')).toBeInTheDocument();
  expect(screen.getByText('仅查看')).toBeInTheDocument();
});

it('calls onAddAssociation when "+ 关联宝宝" clicked', () => {
  const onAdd = vi.fn();
  render(
    <FamilyMemberList
      members={[{ memberId: 'm1', userId: 'u1', username: 'g', nickname: 'G', role: 'member', babyPermissions: [] }]}
      onMemberAction={() => {}}
      onAssociationClick={() => {}}
      onAddAssociation={onAdd}
    />
  );
  fireEvent.click(screen.getByText('+ 关联宝宝'));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ memberId: 'm1' }));
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 重写 FamilyMemberList**

```tsx
'use client';

import * as React from 'react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

export interface FamilyMemberBabyPermission {
  babyId: string;
  babyName: string;
  babyAvatarUrl: string | null;
  permission: 'viewer' | 'editor';
}

export interface FamilyMemberListItem {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'member';
  babyPermissions: FamilyMemberBabyPermission[];
}

export interface FamilyMemberListProps {
  members: FamilyMemberListItem[];
  onMemberAction: (member: FamilyMemberListItem) => void;
  onAssociationClick: (member: FamilyMemberListItem, perm: FamilyMemberBabyPermission) => void;
  onAddAssociation: (member: FamilyMemberListItem) => void;
  canAddDisabledReason?: (member: FamilyMemberListItem) => string | null;
}

export function FamilyMemberList({
  members,
  onMemberAction,
  onAssociationClick,
  onAddAssociation,
  canAddDisabledReason
}: FamilyMemberListProps) {
  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {members.map((member) => {
        const disabledReason = canAddDisabledReason?.(member) ?? null;
        return (
          <li key={member.memberId}>
            <Card>
              <div className="flex items-start gap-[var(--space-3)]">
                <Avatar name={member.nickname} size="lg" className="bg-[var(--color-avatar-blue)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[color:var(--color-fg-strong)]">{member.nickname}</p>
                  <p className="truncate text-[length:var(--text-xs)] text-[color:var(--color-muted)]">@{member.username}</p>
                </div>
                <button
                  type="button"
                  aria-label="更多操作"
                  className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-fg-soft)] active:bg-black/5"
                  onClick={() => onMemberAction(member)}
                >
                  ⋯
                </button>
              </div>

              {member.babyPermissions.length > 0 && (
                <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)] border-t border-[var(--color-border-light)] pt-[var(--space-3)]">
                  {member.babyPermissions.map((perm) => (
                    <li key={perm.babyId}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] py-[var(--space-1)] text-left active:bg-[var(--color-press-tint)]"
                        onClick={() => onAssociationClick(member, perm)}
                      >
                        <Avatar src={perm.babyAvatarUrl ?? undefined} name={perm.babyName} colorKey={perm.babyId} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] text-[color:var(--color-fg)]">{perm.babyName}</span>
                        <span className={cn(
                          'rounded-[var(--radius-pill)] px-[var(--space-2)] py-[2px] text-[10px] font-bold',
                          perm.permission === 'editor'
                            ? 'bg-[var(--color-surface-2)] text-[color:var(--color-fg-strong)]'
                            : 'bg-[var(--color-bg-disabled)] text-[color:var(--color-fg-soft)]'
                        )}>
                          {perm.permission === 'editor' ? '可编辑' : '仅查看'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                disabled={Boolean(disabledReason)}
                onClick={() => onAddAssociation(member)}
                className={cn(
                  'mt-[var(--space-3)] w-full rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-[var(--space-2)] text-[length:var(--text-sm)] font-semibold',
                  disabledReason ? 'cursor-not-allowed text-[color:var(--color-fg-soft)]' : 'text-[color:var(--color-primary-active)] active:bg-[var(--color-press-tint)]'
                )}
              >
                + 关联宝宝
              </button>
              {disabledReason && (
                <p className="mt-[var(--space-1)] text-center text-[length:var(--text-xs)] text-[color:var(--color-fg-soft)]">{disabledReason}</p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
```

> 这一步移除了旧的 `resetSlot` prop 与单按钮模式；调用方 `MembersAdminClient` 在 Task 10 中重写以匹配。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run components/features/FamilyMemberList.test.tsx
```

- [ ] **Step 5: 提交**

```bash
git add components/features/FamilyMemberList.tsx components/features/FamilyMemberList.test.tsx
git commit -m "feat(ui): FamilyMemberList renders baby permission rows + add button"
```

---

## Task 9: 新增 BabyAssociationSheet 组件

**Files:**
- Create: `components/features/BabyAssociationSheet.tsx`
- Create: `components/features/BabyAssociationSheet.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BabyAssociationSheet } from './BabyAssociationSheet';

const babies = [
  { id: 'b1', name: 'Big Bro', avatarUrl: null },
  { id: 'b2', name: 'Sis', avatarUrl: null }
];

it('renders unassociated babies as checkboxes', () => {
  render(
    <BabyAssociationSheet
      open
      onOpenChange={() => {}}
      availableBabies={babies}
      onConfirm={() => {}}
    />
  );
  expect(screen.getByLabelText('Big Bro')).toBeInTheDocument();
  expect(screen.getByLabelText('Sis')).toBeInTheDocument();
});

it('confirm disabled until at least one baby selected', () => {
  render(<BabyAssociationSheet open onOpenChange={() => {}} availableBabies={babies} onConfirm={() => {}} />);
  expect(screen.getByRole('button', { name: '确认' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Big Bro'));
  expect(screen.getByRole('button', { name: '确认' })).not.toBeDisabled();
});

it('returns selected ids and permission on confirm', () => {
  const onConfirm = vi.fn();
  render(<BabyAssociationSheet open onOpenChange={() => {}} availableBabies={babies} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByLabelText('Big Bro'));
  fireEvent.click(screen.getByRole('button', { name: '确认' }));
  expect(onConfirm).toHaveBeenCalledWith({ babyIds: ['b1'], permission: 'editor' });
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 创建组件**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Avatar } from '@/components/ui/Avatar';

export interface BabyOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface BabyAssociationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBabies: BabyOption[];
  defaultPermission?: 'viewer' | 'editor';
  onConfirm: (result: { babyIds: string[]; permission: 'viewer' | 'editor' }) => void;
}

export function BabyAssociationSheet({
  open,
  onOpenChange,
  availableBabies,
  defaultPermission = 'editor',
  onConfirm
}: BabyAssociationSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<'viewer' | 'editor'>(defaultPermission);

  useEffect(() => {
    if (open) {
      setSelected(availableBabies.length === 1 ? new Set([availableBabies[0].id]) : new Set());
      setPermission(defaultPermission);
    }
  }, [open, availableBabies, defaultPermission]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function handleConfirm() {
    onConfirm({ babyIds: Array.from(selected), permission });
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="关联宝宝"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="button" onClick={handleConfirm} disabled={selected.size === 0}>确认</Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--space-3)]">
        {availableBabies.length === 0 ? (
          <p className="text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">已关联全部宝宝</p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-2)]">
            {availableBabies.map((baby) => (
              <li key={baby.id}>
                <label className="flex items-center gap-[var(--space-2)]">
                  <input
                    type="checkbox"
                    aria-label={baby.name}
                    checked={selected.has(baby.id)}
                    onChange={() => toggle(baby.id)}
                  />
                  <Avatar src={baby.avatarUrl ?? undefined} name={baby.name} colorKey={baby.id} size="sm" />
                  <span className="text-[length:var(--text-sm)] text-[color:var(--color-fg)]">{baby.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {availableBabies.length > 0 && (
          <div>
            <p className="mb-[var(--space-1)] text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)]">权限</p>
            <SegmentedControl
              ariaLabel="权限"
              value={permission}
              onChange={(v) => setPermission(v as 'viewer' | 'editor')}
              className="grid-cols-2"
              options={[
                { value: 'editor', label: '可编辑' },
                { value: 'viewer', label: '仅查看' }
              ]}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 提交**

```bash
git add components/features/BabyAssociationSheet.tsx components/features/BabyAssociationSheet.test.tsx
git commit -m "feat(ui): BabyAssociationSheet for multi-select + permission"
```

---

## Task 10: MembersAdminClient 重写

**Files:**
- Modify: `app/profile/members/MembersAdminClient.tsx`
- Modify: `app/profile/members/page.tsx`（标题 & 传入 babies 列表）
- Test: 复用现有 e2e；如有 unit test 同步改

- [ ] **Step 1: 改 server page 取 babies + members**

`app/profile/members/page.tsx`：把 family active babies 查出后传给 client。

```tsx
import { babies as babiesTable } from '@/lib/db/schema';
// ...在 owner 确认后：
const familyBabies = db
  .select({ id: babiesTable.id, name: babiesTable.name, avatarUrl: babiesTable.avatarUrl })
  .from(babiesTable)
  .where(and(eq(babiesTable.familyId, member.familyId), eq(babiesTable.status, 'active')))
  .orderBy(babiesTable.createdAt)
  .all();

return <MembersAdminPage initialBabies={familyBabies} />;
```

import `and`、`eq` from drizzle-orm。

- [ ] **Step 2: 重写 `MembersAdminClient.tsx`**

整体替换为下方结构（保留 reset/remove 流程，新增关联管理）：

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { AppShell } from '@/components/mobile/AppShell';
import { FamilyMemberList, type FamilyMemberListItem, type FamilyMemberBabyPermission } from '@/components/features/FamilyMemberList';
import { BabyAssociationSheet, type BabyOption } from '@/components/features/BabyAssociationSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ChevronLeftIcon, PlusIcon } from '@/components/ui/icons';

interface InitialBaby { id: string; name: string; avatarUrl: string | null; }

interface ApiMember {
  memberId: string;
  userId: string;
  username: string;
  nickname: string;
  role: 'owner' | 'member';
  joinedAt: number;
  babyPermissions: FamilyMemberBabyPermission[];
}

export default function MembersAdminPage({ initialBabies }: { initialBabies: InitialBaby[] }) {
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [babies, setBabies] = useState<InitialBaby[]>(initialBabies);
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState({ username: '', password: '', nickname: '' });
  const [newAssocBabyIds, setNewAssocBabyIds] = useState<Set<string>>(new Set(initialBabies.length === 1 ? [initialBabies[0].id] : []));
  const [newAssocPermission, setNewAssocPermission] = useState<'viewer' | 'editor'>('editor');
  const [activeMember, setActiveMember] = useState<FamilyMemberListItem | null>(null);
  const [resetFor, setResetFor] = useState<FamilyMemberListItem | null>(null);
  const [removeFor, setRemoveFor] = useState<FamilyMemberListItem | null>(null);
  const [assocFor, setAssocFor] = useState<FamilyMemberListItem | null>(null);
  const [editingAssoc, setEditingAssoc] = useState<{ member: FamilyMemberListItem; perm: FamilyMemberBabyPermission } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch('/api/family-members');
    if (!res.ok) return;
    const body = await res.json();
    setMembers(body.members.filter((m: ApiMember) => m.role !== 'owner'));
  }
  useEffect(() => { reload(); }, []);

  function validateNewMember(): string | null {
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(newMember.username)) return '用户名需 3-50 位，仅支持英文、数字、_ 和 -';
    if (!newMember.nickname.trim()) return '请填写昵称';
    if (newMember.password.length < 8) return '初始密码至少 8 位';
    return null;
  }

  async function createNew() {
    setError(null);
    const v = validateNewMember();
    if (v) { setError(v); return; }
    const payload: Record<string, unknown> = {
      username: newMember.username, password: newMember.password, nickname: newMember.nickname
    };
    if (newAssocBabyIds.size > 0) {
      payload.babyAssociations = { babyIds: Array.from(newAssocBabyIds), permission: newAssocPermission };
    }
    const res = await fetch('/api/family-members', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error === 'username_taken' ? '用户名已被占用' : '创建失败，请检查输入');
      return;
    }
    setCreating(false);
    setNewMember({ username: '', password: '', nickname: '' });
    setNewAssocBabyIds(new Set(babies.length === 1 ? [babies[0].id] : []));
    setNewAssocPermission('editor');
    reload();
  }

  async function remove(userId: string) {
    await fetch(`/api/family-members/${userId}`, { method: 'DELETE' });
    setRemoveFor(null);
    reload();
  }

  async function resetPwd(userId: string) {
    if (!resetPassword || resetPassword.length < 8) { setError('新密码至少 8 位'); return; }
    await fetch(`/api/family-members/${userId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: resetPassword })
    });
    setResetFor(null); setResetPassword(''); setError(null);
  }

  async function changeAssoc(memberId: string, babyId: string, permission: 'viewer' | 'editor') {
    await fetch(`/api/family-members/${memberId}/baby-permissions/${babyId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permission })
    });
    setEditingAssoc(null);
    reload();
  }

  async function removeAssoc(memberId: string, babyId: string) {
    await fetch(`/api/family-members/${memberId}/baby-permissions/${babyId}`, { method: 'DELETE' });
    setEditingAssoc(null);
    reload();
  }

  async function addAssocs(memberId: string, babyIds: string[], permission: 'viewer' | 'editor') {
    await fetch(`/api/family-members/${memberId}/baby-permissions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ babyIds, permission })
    });
    setAssocFor(null);
    reload();
  }

  const listItems: FamilyMemberListItem[] = members.map((m) => ({
    memberId: m.memberId, userId: m.userId, username: m.username, nickname: m.nickname, role: m.role,
    babyPermissions: m.babyPermissions
  }));

  function disabledReason(item: FamilyMemberListItem): string | null {
    if (babies.length === 0) return '请先在「宝宝管理」中添加宝宝';
    if (item.babyPermissions.length >= babies.length) return '已关联全部宝宝';
    return null;
  }

  function availableBabiesFor(item: FamilyMemberListItem): BabyOption[] {
    const taken = new Set(item.babyPermissions.map((p) => p.babyId));
    return babies.filter((b) => !taken.has(b.id)).map((b) => ({ id: b.id, name: b.name, avatarUrl: b.avatarUrl }));
  }

  return (
    <AppShell title="成员管理" leftSlot={
      <Link href="/profile" aria-label="返回" className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] active:bg-black/5">
        <ChevronLeftIcon />
      </Link>
    }>
      {error && <p role="alert" className="mb-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--color-error)]">{error}</p>}

      {listItems.length === 0 && !creating && (
        <Card className="mb-[var(--space-4)] text-center text-[length:var(--text-sm)] text-[color:var(--color-fg-soft)]">
          还没有家人加入
        </Card>
      )}

      <div className="mb-[var(--space-6)]">
        <FamilyMemberList
          members={listItems}
          onMemberAction={setActiveMember}
          onAssociationClick={(member, perm) => setEditingAssoc({ member, perm })}
          onAddAssociation={setAssocFor}
          canAddDisabledReason={disabledReason}
        />
      </div>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
          <Input label="用户名" placeholder="用户名 (3-50, a-z0-9_-)" value={newMember.username} onChange={(e) => setNewMember({ ...newMember, username: e.target.value })} />
          <Input label="昵称" placeholder="昵称" value={newMember.nickname} onChange={(e) => setNewMember({ ...newMember, nickname: e.target.value })} />
          <PasswordInput label="初始密码" placeholder="初始密码 (≥8)" value={newMember.password} onChange={(e) => setNewMember({ ...newMember, password: e.target.value })} />
          {babies.length > 0 && (
            <fieldset className="flex flex-col gap-[var(--space-2)]">
              <legend className="text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg)]">关联宝宝（可跳过）</legend>
              {babies.map((b) => (
                <label key={b.id} className="flex items-center gap-[var(--space-2)]">
                  <input
                    type="checkbox"
                    checked={newAssocBabyIds.has(b.id)}
                    onChange={() => {
                      const next = new Set(newAssocBabyIds);
                      if (next.has(b.id)) next.delete(b.id); else next.add(b.id);
                      setNewAssocBabyIds(next);
                    }}
                  />
                  <span className="text-[length:var(--text-sm)]">{b.name}</span>
                </label>
              ))}
              {newAssocBabyIds.size > 0 && (
                <select
                  value={newAssocPermission}
                  onChange={(e) => setNewAssocPermission(e.target.value as 'viewer' | 'editor')}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)]"
                >
                  <option value="editor">可编辑</option>
                  <option value="viewer">仅查看</option>
                </select>
              )}
            </fieldset>
          )}
          <div className="mt-[var(--space-1)] grid grid-cols-2 gap-[var(--space-2)]">
            <Button type="button" size="md" onClick={createNew} fullWidth>创建</Button>
            <Button type="button" size="md" variant="default" onClick={() => setCreating(false)} fullWidth>取消</Button>
          </div>
        </Card>
      ) : (
        <Button type="button" variant="secondary" leadingIcon={<PlusIcon />} onClick={() => setCreating(true)} fullWidth>
          添加成员
        </Button>
      )}

      {activeMember && (
        <ActionSheet
          open={Boolean(activeMember)}
          onOpenChange={(open) => { if (!open) setActiveMember(null); }}
          title={`${activeMember.nickname} · @${activeMember.username}`}
          options={[
            { label: '重置密码', onSelect: () => setResetFor(activeMember) },
            { label: '移除成员', destructive: true, onSelect: () => setRemoveFor(activeMember) }
          ]}
        />
      )}

      {editingAssoc && (
        <ActionSheet
          open={Boolean(editingAssoc)}
          onOpenChange={(o) => { if (!o) setEditingAssoc(null); }}
          title={editingAssoc.perm.babyName}
          options={[
            ...(editingAssoc.perm.permission === 'editor'
              ? [{ label: '改为「仅查看」', onSelect: () => changeAssoc(editingAssoc.member.memberId, editingAssoc.perm.babyId, 'viewer') }]
              : [{ label: '改为「可编辑」', onSelect: () => changeAssoc(editingAssoc.member.memberId, editingAssoc.perm.babyId, 'editor') }]),
            { label: '解除关联', destructive: true, onSelect: () => removeAssoc(editingAssoc.member.memberId, editingAssoc.perm.babyId) }
          ]}
        />
      )}

      {assocFor && (
        <BabyAssociationSheet
          open={Boolean(assocFor)}
          onOpenChange={(o) => { if (!o) setAssocFor(null); }}
          availableBabies={availableBabiesFor(assocFor)}
          onConfirm={({ babyIds, permission }) => addAssocs(assocFor.memberId, babyIds, permission)}
        />
      )}

      <Dialog
        open={Boolean(resetFor)}
        onOpenChange={(o) => { if (!o) { setResetFor(null); setResetPassword(''); } }}
        title="重置密码"
        footer={<>
          <Button type="button" variant="ghost" onClick={() => setResetFor(null)}>取消</Button>
          <Button type="button" onClick={() => resetFor && resetPwd(resetFor.userId)}>保存</Button>
        </>}
      >
        <PasswordInput value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="新密码 (至少 8 位)" label="新密码" />
      </Dialog>

      <Dialog
        open={Boolean(removeFor)}
        onOpenChange={(o) => { if (!o) setRemoveFor(null); }}
        title="移除成员"
        footer={<>
          <Button type="button" variant="ghost" onClick={() => setRemoveFor(null)}>取消</Button>
          <Button type="button" variant="error" onClick={() => removeFor && remove(removeFor.userId)}>移除</Button>
        </>}
      >
        <p className="text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          确认移除 {removeFor?.nickname ?? '该成员'}? 该成员将无法登录,但他们已记录的内容会保留。
        </p>
      </Dialog>
    </AppShell>
  );
}
```

注意：
- 删除 `import { SegmentedControl }` （已不用）
- 删除 `Link href="/profile/members/permissions"` 整块
- 删除 `changeRole` 函数

- [ ] **Step 3: 手动验证页面**

```bash
pnpm dev
```

打开 `/profile/members`，检查：标题为"成员管理"、列表不含主理人、创建表单无 SegmentedControl、关联交互正常。

- [ ] **Step 4: 提交**

```bash
git add app/profile/members/MembersAdminClient.tsx app/profile/members/page.tsx
git commit -m "feat(ui): rewrite members admin client with inline associations"
```

---

## Task 11: 删除旧矩阵页 + profile 入口改名

**Files:**
- Delete: `app/profile/members/permissions/page.tsx`
- Delete: `app/profile/members/permissions/actions.ts`
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: 删除旧文件**

```bash
rm app/profile/members/permissions/page.tsx
rm app/profile/members/permissions/actions.ts
rmdir app/profile/members/permissions
```

- [ ] **Step 2: 改 `app/profile/page.tsx`**

修改 `ownerLinks`：

```ts
const ownerLinks: ProfileLink[] = [
  { href: '/profile/members', label: '成员管理', icon: 'members', meta: countMeta(memberCount, '人') },
  { href: '/profile/milestones', label: '里程碑', icon: 'star', meta: countMeta(milestoneCount, '个') }
];
```

修改 role 类型与计算：

```ts
const role: 'owner' | 'member' = member.role === 'owner' ? 'owner' : 'member';
const isOwner = role === 'owner';

// canUseTrash / canBulkUpload: 主理人或对任一宝宝有 canDelete/canWrite
const memberCaps = isOwner ? { hasAnyWrite: true, hasAnyDelete: true } : computeCaps(db, member.id);
const canUseTrash = isOwner || memberCaps.hasAnyDelete;
const canBulkUpload = isOwner || memberCaps.hasAnyWrite;
```

新增本地函数：

```ts
function computeCaps(db: ReturnType<typeof getDb>['db'], familyMemberId: string) {
  const rows = db
    .select({ canWrite: babyMemberPermissions.canWrite, canDelete: babyMemberPermissions.canDelete })
    .from(babyMemberPermissions)
    .where(eq(babyMemberPermissions.familyMemberId, familyMemberId))
    .all();
  return {
    hasAnyWrite: rows.some((r) => r.canWrite === 1),
    hasAnyDelete: rows.some((r) => r.canDelete === 1)
  };
}
```

import `babyMemberPermissions`。

`listReadableBabies` 调用：role 形参传 `'owner' | 'member'`：

```ts
role: role,
```

`RolePill` 改写（只两态）：

```tsx
function RolePill({ role }: { role: 'owner' | 'member' }) {
  if (role === 'owner') {
    return <span className="..." style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary-active)' }}>家庭主理人</span>;
  }
  return null; // 普通成员不显示徽章
}
```

调用处：`<RolePill role={role} />`。

- [ ] **Step 3: 修复同一文件中其他 role 类型引用**

把所有 `member.role` 的直接使用替换为 `role` 局部变量；把 `as 'owner' | 'editor' | 'viewer'` 全部替换为 `'owner' | 'member'`。

- [ ] **Step 4: 跑构建确认无类型错误**

```bash
pnpm tsc --noEmit --pretty false
```

期望：profile/page.tsx 编译通过；其它 role 类型错误进入 Task 12 处理。

- [ ] **Step 5: 提交**

```bash
git rm -r app/profile/members/permissions
git add app/profile/page.tsx
git commit -m "feat(ui): rename to 成员管理; remove old permissions matrix; member role pill"
```

---

## Task 12: 扫尾所有 editor/viewer role 引用

**Files:**
- Modify: `app/entry/[id]/page.tsx`
- Modify: `app/profile/trash/page.tsx`
- Modify: `app/profile/trash/TrashClient.tsx`
- Modify: `app/profile/bulk-upload/page.tsx`
- Modify: `app/timeline/page.tsx`、`app/gallery/page.tsx`、`app/calendar/page.tsx`
- Modify: `app/api/trash/route.ts`

- [ ] **Step 1: 跑全量 tsc 列出剩余错误**

```bash
pnpm tsc --noEmit --pretty false 2>&1 | grep -E "editor|viewer" | head -40
```

- [ ] **Step 2: 逐个修复**

**`app/entry/[id]/page.tsx:58`** — `canEditEntry` 判断改为 baby_member_permissions 查询：

```ts
const canEditEntry = await (async () => {
  if (member?.role === 'owner') return true;
  if (!member) return false;
  const perm = db
    .select()
    .from(babyMemberPermissions)
    .where(and(
      eq(babyMemberPermissions.familyMemberId, member.id),
      eq(babyMemberPermissions.babyId, entry.babyId)
    ))
    .get();
  return perm?.canWrite === 1;
})();
```

import `babyMemberPermissions`。

**`app/profile/trash/page.tsx`** — gate 改造：

```ts
const role: 'owner' | 'member' = member.role === 'owner' ? 'owner' : 'member';
if (role !== 'owner') {
  // member 必须对任一宝宝有 canDelete=1
  const hasAny = db
    .select({ id: babyMemberPermissions.id })
    .from(babyMemberPermissions)
    .where(and(
      eq(babyMemberPermissions.familyMemberId, member.id),
      eq(babyMemberPermissions.canDelete, 1)
    ))
    .get();
  if (!hasAny) redirect('/profile');
}
```

**`TrashClient.tsx`** — `type TrashRole = 'owner' | 'member'`。

**`app/profile/bulk-upload/page.tsx`** — 类似 trash：member 必须有任一 canWrite=1。

**`app/api/trash/route.ts:19`** — `allowRoles: ['owner', 'editor']` 改为依赖 assertPermission 而不是简单 role 列表，或调整 route-template 以支持新二态：

把 `allowRoles: ['owner', 'editor']` 改为 `allowRoles: ['owner', 'member']`，但 route-template 现在已是二态。如果原意是"非主理人需 canDelete"，那应改为在 handler 内 assertPermission（参考 Task 1 strict 模型）。

简化版：保留 `allowRoles: ['owner', 'member']`，handler 内对每个 entry/media 走 assertPermission 校验 entry:restore/media:restore 的 babyId 维度权限即可。

**`timeline/gallery/calendar/page.tsx`** — `as 'owner' | 'editor' | 'viewer'` → `as 'owner' | 'member'`（或上一行直接计算）。

- [ ] **Step 3: 跑 tsc 确认无类型错误**

```bash
pnpm tsc --noEmit --pretty false
```

- [ ] **Step 4: 跑全部测试**

```bash
pnpm test
```

修复任何因 role 收敛导致的测试失败。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: drop editor/viewer role across app surfaces"
```

---

## Task 13: E2E 主流程验证

**Files:**
- Create: `tests/e2e/member-permissions.spec.ts`

- [ ] **Step 1: 写 Playwright 测试**

```ts
import { test, expect } from '@playwright/test';

test('owner can create member with associations, edit, and remove', async ({ page }) => {
  // 登录主理人（沿用现有 fixture）
  await page.goto('/login');
  await page.fill('input[name=username]', 'owner');
  await page.fill('input[name=password]', 'ownerpw123');
  await page.click('button[type=submit]');

  await page.goto('/profile/members');
  await expect(page.locator('h1')).toContainText('成员管理');

  // 创建成员
  await page.click('text=添加成员');
  await page.fill('input[placeholder*="用户名"]', 'grandpa');
  await page.fill('input[placeholder*="昵称"]', '爷爷');
  await page.fill('input[placeholder*="初始密码"]', 'pw12345678');
  // 假设家中有一个 active baby，自动勾选
  await page.click('text=创建');

  await expect(page.locator('text=爷爷')).toBeVisible();

  // 改档
  await page.locator('text=爷爷').locator('..').locator('text=可编辑').first().click();
  await page.click('text=改为「仅查看」');
  await expect(page.locator('text=爷爷').locator('..').locator('text=仅查看').first()).toBeVisible();

  // 解除关联
  await page.locator('text=爷爷').locator('..').locator('text=仅查看').first().click();
  await page.click('text=解除关联');
  await expect(page.locator('text=爷爷').locator('..').locator('text=+ 关联宝宝')).toBeVisible();

  // 移除成员
  await page.locator('text=爷爷').locator('..').locator('button[aria-label=更多操作]').click();
  await page.click('text=移除成员');
  await page.click('text=移除');
  await expect(page.locator('text=爷爷')).not.toBeVisible();
});

test('non-owner cannot access members page', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=username]', 'member');
  await page.fill('input[name=password]', 'memberpw123');
  await page.click('button[type=submit]');

  await page.goto('/profile/members');
  await expect(page).toHaveURL(/\/profile/);
});
```

- [ ] **Step 2: 跑 e2e**

```bash
pnpm test:e2e tests/e2e/member-permissions.spec.ts
```

- [ ] **Step 3: 修复发现的问题**

如遇 selector 不稳定或交互细节差异，按实测调整。

- [ ] **Step 4: 提交**

```bash
git add tests/e2e/member-permissions.spec.ts
git commit -m "test(e2e): member permissions main flow"
```

---

## Task 14: 最终验收

- [ ] **Step 1: 跑全部测试**

```bash
pnpm test
pnpm test:e2e
pnpm tsc --noEmit --pretty false
```

期望：全绿。

- [ ] **Step 2: 手动 smoke test**

```bash
pnpm dev
```

逐项验证（按 spec §14 关键决定表）：
- [ ] 页面标题"成员管理"
- [ ] "我的"页入口卡片名为"成员管理"，无"宝宝权限"
- [ ] 主理人不在列表
- [ ] 0 关联成员只显示账号信息 + "+ 关联宝宝"按钮
- [ ] 0 宝宝时按钮 disabled 带提示
- [ ] 1 宝宝时点 "+ 关联宝宝" 预选该宝宝
- [ ] 多宝宝时多选 + 全局权限
- [ ] 点关联记录 → ActionSheet 改档/解除
- [ ] 创建表单顶部无角色 SegmentedControl
- [ ] 创建表单有关联区块（0/1/N 宝宝形态正确）
- [ ] 非主理人访问 `/profile/members` → notFound 或重定向

- [ ] **Step 3: 跑 lint / prettier**

```bash
pnpm prettier --write .
pnpm eslint --fix .
```

- [ ] **Step 4: 最后提交（如有 lint 修复）**

```bash
git add -A
git commit -m "chore: lint fixes" --allow-empty
```

---

## Self-Review 通过项

- 所有 spec §1-§14 章节都映射到至少一个 Task
- 无 TBD/TODO/占位
- 类型一致性：`'owner' | 'member'` 在 schema 注释、assert、route-template、queries、UI 全链路统一
- `Permission = 'viewer' | 'editor'` 在 API body、UI props、queries 全链路统一
- 测试先行：所有 lib/API 任务先写测试再实现，UI 任务写组件单测
- 提交粒度：每个 Task 一次或两次提交，频率合理
