import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

function postReq(body: unknown): any {
  return new Request('http://localhost/api/entries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('POST /api/entries authorization', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-entries-route-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  it('denies editor create when baby canWrite override is disabled', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const { getDb } = await import('@/lib/db/client');
    const { users, families, familyMembers, babyMemberPermissions, entries } =
      await import('@/lib/db/schema');
    const { db } = getDb({ dataDir });

    const family = db.select().from(families).all()[0];
    const editorId = randomUUID();
    const editorMemberId = randomUUID();
    const now = new Date();
    db.insert(users)
      .values({
        id: editorId,
        name: 'Editor',
        email: 'editor@local.babyloom',
        emailVerified: true,
        username: 'editor',
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
        canWrite: 0,
        canDelete: 1
      })
      .run();

    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => editorId
    }));
    const { POST } = await import('@/app/api/entries/route');

    const res = await POST(postReq({ babyId: ctx.babyId, content: 'blocked create' }));
    expect(res.status).toBe(404);
    const rows = db.select().from(entries).all();
    expect(rows.some((entry) => entry.content === 'blocked create')).toBe(false);
  });
});
