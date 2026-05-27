import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

describe('avatar API routes', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-avatar-route-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    const { resetDbForTesting } = await import('@/lib/db/client');
    resetDbForTesting();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('uploads my avatar, writes it to disk, stores a cache-busted URL, and serves it', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const { getDb } = await import('@/lib/db/client');
    const { users } = await import('@/lib/db/schema');
    const { avatarFilePath } = await import('@/lib/server/avatar/paths');
    const { POST } = await import('@/app/api/avatar/route');
    const { GET } = await import('@/app/api/avatar/[kind]/[id]/route');

    const res = await POST(await avatarRequest('me'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toMatch(new RegExp(`^/api/avatar/users/${ctx.ownerId}\\.webp\\?v=\\d+$`));
    expect(existsSync(avatarFilePath('users', ctx.ownerId, dataDir))).toBe(true);

    const { db } = getDb({ dataDir });
    const owner = db.select().from(users).where(eq(users.id, ctx.ownerId)).get();
    expect(owner?.image).toBe(body.url);

    const served = await GET(
      new Request(`http://localhost/api/avatar/users/${ctx.ownerId}.webp`) as any
    );
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');
    expect(served.headers.get('cache-control')).toContain('immutable');
  });

  it('hides baby avatar upload from non-owner family members', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const { getDb } = await import('@/lib/db/client');
    const { users, families, familyMembers, babies, babyMemberPermissions } =
      await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });
    const family = db.select().from(families).get()!;
    const editorId = randomUUID();
    const editorMemberId = randomUUID();
    const now = new Date();
    db.insert(users)
      .values({
        id: editorId,
        name: 'Editor',
        email: 'editor-avatar@local.babyloom',
        emailVerified: true,
        username: 'editor-avatar',
        role: 'editor',
        createdAt: now,
        updatedAt: now
      })
      .run();
    db.insert(familyMembers)
      .values({
        id: editorMemberId,
        familyId: family.id,
        userId: editorId,
        role: 'editor',
        joinedAt: Date.now()
      })
      .run();
    db.insert(babyMemberPermissions)
      .values({
        id: randomUUID(),
        babyId: ctx.babyId,
        familyMemberId: editorMemberId,
        canRead: 1,
        canWrite: 1,
        canDelete: 1
      })
      .run();
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => editorId
    }));
    const { POST } = await import('@/app/api/avatar/route');

    const res = await POST(await avatarRequest(`baby:${ctx.babyId}`));
    const baby = db.select().from(babies).where(eq(babies.id, ctx.babyId)).get();

    expect(res.status).toBe(404);
    expect(baby?.avatarUrl).toBeNull();
  });
});

async function avatarRequest(target: string) {
  const input = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: '#224466'
    }
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set('target', target);
  form.set('file', new Blob([new Uint8Array(input)], { type: 'image/png' }), 'avatar.png');
  return new Request('http://localhost/api/avatar', {
    method: 'POST',
    body: form
  }) as any;
}
