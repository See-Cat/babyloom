import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers()
}));

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
  const { bootstrapOwner, hashPassword, ownerInternalEmail } = await import('@/lib/bootstrap/owner');
  await bootstrapOwner({ dataDir });

  const { getDb } = await import('@/lib/db/client');
  const { db } = getDb({ dataDir });
  const { users, accounts, families, familyMembers, babies, babyMemberPermissions } =
    await import('@/lib/db/schema');

  const owner = db.select().from(users).all()[0];
  const family = db.select().from(families).all()[0];
  const nowMs = Date.now();
  const nowDate = new Date(nowMs);
  const editorId = randomUUID();
  const editorMemberId = randomUUID();
  const babyId = randomUUID();

  db.insert(users)
    .values({
      id: editorId,
      name: 'Editor',
      email: ownerInternalEmail('editor'),
      emailVerified: true,
      username: 'editor',
      role: 'editor',
      createdAt: nowDate,
      updatedAt: nowDate
    })
    .run();
  db.insert(accounts)
    .values({
      id: randomUUID(),
      userId: editorId,
      providerId: 'credential',
      accountId: ownerInternalEmail('editor'),
      password: hashPassword('editor-test-pw'),
      createdAt: nowDate,
      updatedAt: nowDate
    })
    .run();
  db.insert(familyMembers)
    .values({
      id: editorMemberId,
      familyId: family.id,
      userId: editorId,
      role: 'editor',
      joinedAt: nowMs
    })
    .run();
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

  return { ownerId: owner.id, editorId, editorMemberId, babyId, db, babyMemberPermissions };
}

function cellForm(overrides: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

describe('permissions server actions', () => {
  let dataDir: string;
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock('@/lib/permissions/session');
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-permissions-actions-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
    ctx = await seed(dataDir);
  });

  it('rejects non-owner callers as not_found', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => ctx.editorId
    }));
    const { setPermissionCell } = await import('@/app/profile/members/permissions/actions');

    await expect(
      setPermissionCell(
        cellForm({
          memberId: ctx.editorMemberId,
          babyId: ctx.babyId,
          field: 'canRead',
          value: 'true'
        })
      )
    ).resolves.toEqual({ ok: false, error: 'not_found' });
  });

  it('sets a single permission bit for owners', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => ctx.ownerId
    }));
    const { setPermissionCell } = await import('@/app/profile/members/permissions/actions');

    await expect(
      setPermissionCell(
        cellForm({
          memberId: ctx.editorMemberId,
          babyId: ctx.babyId,
          field: 'canWrite',
          value: 'true'
        })
      )
    ).resolves.toEqual({ ok: true });

    expect(ctx.db.select().from(ctx.babyMemberPermissions).all()).toMatchObject([
      { familyMemberId: ctx.editorMemberId, babyId: ctx.babyId, canRead: 1, canWrite: 1, canDelete: 1 }
    ]);
  });

  it('keeps the row when clearing the last enabled bit', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => ctx.ownerId
    }));
    const { setPermissionCell } = await import('@/app/profile/members/permissions/actions');

    await setPermissionCell(
      cellForm({
        memberId: ctx.editorMemberId,
        babyId: ctx.babyId,
        field: 'canRead',
        value: 'true'
      })
    );
    await setPermissionCell(
      cellForm({
        memberId: ctx.editorMemberId,
        babyId: ctx.babyId,
        field: 'canRead',
        value: 'false'
      })
    );

    expect(ctx.db.select().from(ctx.babyMemberPermissions).all()).toMatchObject([
      { familyMemberId: ctx.editorMemberId, babyId: ctx.babyId, canRead: 0, canWrite: 1, canDelete: 1 }
    ]);
  });

  it('resets one member to role defaults', async () => {
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserIdFromHeaders: async () => ctx.ownerId
    }));
    const { resetMemberRow, setPermissionCell } = await import(
      '@/app/profile/members/permissions/actions'
    );

    await setPermissionCell(
      cellForm({
        memberId: ctx.editorMemberId,
        babyId: ctx.babyId,
        field: 'canRead',
        value: 'true'
      })
    );

    await expect(resetMemberRow(ctx.editorMemberId)).resolves.toEqual({ ok: true });
    expect(ctx.db.select().from(ctx.babyMemberPermissions).all()).toEqual([]);
  });
});
