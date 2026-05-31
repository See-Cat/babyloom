import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { cascadeRestoreEntryMedia, cascadeTrashEntryMedia } from './entry-media-cascade';

let dataDir: string;

async function setup() {
  const { resetDbForTesting, getDb } = await import('@/lib/server/db/client');
  resetDbForTesting();
  const { runMigrations } = await import('@/lib/server/db/migrate');
  runMigrations(dataDir);
  const { db } = getDb({ dataDir });
  const schema = await import('@/lib/server/db/schema');
  return { db, schema };
}

const now = 1_700_000_000_000;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'bl-cascade-'));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('entry media cascade', () => {
  it('trashes only media left with no active entry, then restores them', async () => {
    const { db, schema } = await setup();
    const userId = randomUUID();
    const familyId = randomUUID();
    const babyId = randomUUID();
    const entryA = randomUUID();
    const entryB = randomUUID();
    const mediaOnlyA = randomUUID();
    const mediaShared = randomUUID();
    const mediaStandalone = randomUUID();

    db.insert(schema.users)
      .values({
        id: userId,
        name: 'Owner',
        email: 'o@local.babyloom',
        emailVerified: true,
        username: 'owner',
        role: 'owner',
        createdAt: new Date(now),
        updatedAt: new Date(now)
      })
      .run();
    db.insert(schema.families).values({ id: familyId, name: 'Fam', ownerUserId: userId, createdAt: now, updatedAt: now }).run();
    db.insert(schema.babies)
      .values({ id: babyId, familyId, name: 'B', birthday: '2025-01-01', gender: 'girl', status: 'active', createdAt: now, updatedAt: now })
      .run();

    const mkEntry = (id: string) => ({ id, babyId, authorId: userId, content: '', occurredAt: now, status: 'active' as const, createdAt: now, updatedAt: now });
    db.insert(schema.entries).values([mkEntry(entryA), mkEntry(entryB)]).run();

    const mkMedia = (id: string) => ({ id, babyId, uploadedBy: userId, clientUploadId: id, filename: 'f', type: 'photo', status: 'ready' as const, createdAt: now, updatedAt: now });
    db.insert(schema.media).values([mkMedia(mediaOnlyA), mkMedia(mediaShared), mkMedia(mediaStandalone)]).run();

    db.insert(schema.entryMedia)
      .values([
        { entryId: entryA, mediaId: mediaOnlyA, attachedBy: userId, attachedAt: now },
        { entryId: entryA, mediaId: mediaShared, attachedBy: userId, attachedAt: now },
        { entryId: entryB, mediaId: mediaShared, attachedBy: userId, attachedAt: now }
      ])
      .run();

    const statusOf = (id: string) => db.select({ status: schema.media.status }).from(schema.media).where(eq(schema.media.id, id)).get()?.status;

    // Trash entry A: mediaOnlyA -> trashed; mediaShared kept (still on active B); standalone untouched.
    cascadeTrashEntryMedia(db, entryA, userId, now);
    expect(statusOf(mediaOnlyA)).toBe('trashed');
    expect(statusOf(mediaShared)).toBe('ready');
    expect(statusOf(mediaStandalone)).toBe('ready');

    // Restore entry A: its trashed media come back.
    cascadeRestoreEntryMedia(db, entryA, now);
    expect(statusOf(mediaOnlyA)).toBe('ready');
  });
});
