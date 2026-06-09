import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

const SETTINGS_URL = 'http://localhost/api/settings/media-cleanup';
const RUN_URL = 'http://localhost/api/settings/media-cleanup/run';
const COUNT_URL = 'http://localhost/api/settings/media-cleanup/eligible-count';

const HOUR_MS = 60 * 60 * 1000;

function req(url: string, method: string, body?: unknown): any {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function mockSession(userId: string) {
  vi.doMock('@/lib/server/permissions/session', () => ({
    getSessionUserId: async () => userId
  }));
}

async function seedMember(dataDir: string): Promise<string> {
  const { getDb } = await import('@/lib/server/db/client');
  const { users, familyMembers, families } = await import('@/lib/server/db/schema');
  const { db } = getDb({ dataDir });
  const family = db.select().from(families).all()[0];
  const userId = randomUUID();
  const now = Date.now();
  db.insert(users)
    .values({
      id: userId,
      name: 'Mem',
      email: `mem-${userId}@x.test`,
      emailVerified: true,
      username: `mem-${userId}`,
      role: 'member',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    })
    .run();
  db.insert(familyMembers)
    .values({ id: randomUUID(), familyId: family.id, userId, role: 'member', joinedAt: now })
    .run();
  return userId;
}

async function insertOrphan(
  dataDir: string,
  babyId: string,
  uploadedBy: string,
  ageHours: number
): Promise<string> {
  const { getDb } = await import('@/lib/server/db/client');
  const { media } = await import('@/lib/server/db/schema');
  const { db } = getDb({ dataDir });
  const id = randomUUID();
  const created = Date.now() - ageHours * HOUR_MS;
  db.insert(media)
    .values({
      id,
      babyId,
      uploadedBy,
      clientUploadId: randomUUID(),
      origin: 'entry_draft',
      status: 'ready',
      filename: 'x.jpg',
      createdAt: created,
      updatedAt: created
    })
    .run();
  return id;
}

describe('owner-only media-cleanup API', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-cleanup-api-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/server/permissions/session');
    vi.doUnmock('@/lib/server/media/reconcile');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
    delete process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE;
  });

  // ─── 5.1 owner-only on every endpoint ──────────────────────────────────
  it('member gets 404 on GET settings; owner gets the settings', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const memberId = await seedMember(dataDir);

    mockSession(memberId);
    let mod = await import('@/app/api/settings/media-cleanup/route');
    expect((await mod.GET(req(SETTINGS_URL, 'GET'))).status).toBe(404);

    vi.resetModules();
    mockSession(ctx.ownerId);
    mod = await import('@/app/api/settings/media-cleanup/route');
    const res = await mod.GET(req(SETTINGS_URL, 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.thresholdHours).toBe(24);
  });

  it('member gets 404 on PUT settings', async () => {
    await seedOwnerBabyEntries(dataDir);
    const memberId = await seedMember(dataDir);
    mockSession(memberId);
    const mod = await import('@/app/api/settings/media-cleanup/route');
    const res = await mod.PUT(req(SETTINGS_URL, 'PUT', { enabled: false }));
    expect(res.status).toBe(404);
  });

  it('member gets 404 on run-now', async () => {
    await seedOwnerBabyEntries(dataDir);
    const memberId = await seedMember(dataDir);
    mockSession(memberId);
    const mod = await import('@/app/api/settings/media-cleanup/run/route');
    const res = await mod.POST(req(RUN_URL, 'POST'));
    expect(res.status).toBe(404);
  });

  it('member gets 404 on eligible-count', async () => {
    await seedOwnerBabyEntries(dataDir);
    const memberId = await seedMember(dataDir);
    mockSession(memberId);
    const mod = await import('@/app/api/settings/media-cleanup/eligible-count/route');
    const res = await mod.GET(req(COUNT_URL, 'GET'));
    expect(res.status).toBe(404);
  });

  // ─── 5.2 env kill-switch UX + manual override on run-now ───────────────
  it('run-now returns 503 when the env kill-switch is set and trashes nothing', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const orphanId = await insertOrphan(dataDir, ctx.babyId, ctx.ownerId, 50);
    process.env.BABYLOOM_DISABLE_MEDIA_RECONCILE = '1';

    mockSession(ctx.ownerId);
    const mod = await import('@/app/api/settings/media-cleanup/run/route');
    const res = await mod.POST(req(RUN_URL, 'POST'));
    expect(res.status).toBe(503);

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });
    expect(db.select({ s: media.status }).from(media).where(eq(media.id, orphanId)).get()?.s).toBe('ready');
  });

  it('run-now with the DB enabled flag OFF still trashes eligible orphans and updates stats', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const orphanId = await insertOrphan(dataDir, ctx.babyId, ctx.ownerId, 50);
    const { updateCleanupSettings } = await import('@/lib/server/settings/cleanup');
    updateCleanupSettings({ dataDir, enabled: false, nowMs: Date.now() });

    mockSession(ctx.ownerId);
    const mod = await import('@/app/api/settings/media-cleanup/run/route');
    const res = await mod.POST(req(RUN_URL, 'POST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orphansTrashed).toBe(1);

    const { getDb } = await import('@/lib/server/db/client');
    const { media } = await import('@/lib/server/db/schema');
    const { eq } = await import('drizzle-orm');
    const { db } = getDb({ dataDir });
    expect(db.select({ s: media.status }).from(media).where(eq(media.id, orphanId)).get()?.s).toBe('trashed');

    const { getCleanupSettings } = await import('@/lib/server/settings/cleanup');
    expect(getCleanupSettings({ dataDir }).lastRunDeleted).toBe(1);
  });

  // ─── 5.3 backup write barrier ──────────────────────────────────────────
  it('PUT settings during a backup returns 503 and mutates nothing', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    mockSession(ctx.ownerId);
    const { setBackupInProgress } = await import('@/lib/server/backup/write-barrier');
    setBackupInProgress(true);
    try {
      const mod = await import('@/app/api/settings/media-cleanup/route');
      const res = await mod.PUT(req(SETTINGS_URL, 'PUT', { enabled: false, thresholdHours: 100 }));
      expect(res.status).toBe(503);
      const { getCleanupSettings } = await import('@/lib/server/settings/cleanup');
      const s = getCleanupSettings({ dataDir });
      expect(s.enabled).toBe(true);
      expect(s.thresholdHours).toBe(24);
    } finally {
      setBackupInProgress(false);
    }
  });

  it('run-now during a backup returns 503 and trashes nothing', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    const orphanId = await insertOrphan(dataDir, ctx.babyId, ctx.ownerId, 50);
    mockSession(ctx.ownerId);
    const { setBackupInProgress } = await import('@/lib/server/backup/write-barrier');
    setBackupInProgress(true);
    try {
      const mod = await import('@/app/api/settings/media-cleanup/run/route');
      const res = await mod.POST(req(RUN_URL, 'POST'));
      expect(res.status).toBe(503);
      const { getDb } = await import('@/lib/server/db/client');
      const { media } = await import('@/lib/server/db/schema');
      const { eq } = await import('drizzle-orm');
      const { db } = getDb({ dataDir });
      expect(db.select({ s: media.status }).from(media).where(eq(media.id, orphanId)).get()?.s).toBe('ready');
    } finally {
      setBackupInProgress(false);
    }
  });

  it('run-now returns 503 when the cleanup primitive reports it skipped (honors the skip contract)', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    // Force the primitive to skip even though the route's own pre-checks pass —
    // the route must consume `result.skipped` rather than report a phantom success.
    vi.doMock('@/lib/server/media/reconcile', () => ({
      runReconcileOnce: async () => ({ skipped: true, orphansTrashed: 0 })
    }));
    mockSession(ctx.ownerId);
    const mod = await import('@/app/api/settings/media-cleanup/run/route');
    const res = await mod.POST(req(RUN_URL, 'POST'));
    expect(res.status).toBe(503);
  });

  it('GET settings and eligible-count still succeed during a backup (reads are exempt)', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    mockSession(ctx.ownerId);
    const { setBackupInProgress } = await import('@/lib/server/backup/write-barrier');
    setBackupInProgress(true);
    try {
      const settingsMod = await import('@/app/api/settings/media-cleanup/route');
      expect((await settingsMod.GET(req(SETTINGS_URL, 'GET'))).status).toBe(200);
      const countMod = await import('@/app/api/settings/media-cleanup/eligible-count/route');
      expect((await countMod.GET(req(COUNT_URL, 'GET'))).status).toBe(200);
    } finally {
      setBackupInProgress(false);
    }
  });

  // ─── 5.4 behavior: PUT validation + persistence, eligible-count preview ──
  it('PUT rejects an out-of-range threshold with 400 and persists nothing', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    mockSession(ctx.ownerId);
    const mod = await import('@/app/api/settings/media-cleanup/route');

    expect((await mod.PUT(req(SETTINGS_URL, 'PUT', { thresholdHours: 1 }))).status).toBe(400);
    expect((await mod.PUT(req(SETTINGS_URL, 'PUT', { thresholdHours: 1000 }))).status).toBe(400);

    const { getCleanupSettings } = await import('@/lib/server/settings/cleanup');
    expect(getCleanupSettings({ dataDir }).thresholdHours).toBe(24);
  });

  it('PUT persists an in-range threshold and toggled enabled', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    mockSession(ctx.ownerId);
    const mod = await import('@/app/api/settings/media-cleanup/route');

    const res = await mod.PUT(req(SETTINGS_URL, 'PUT', { enabled: false, thresholdHours: 72 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.thresholdHours).toBe(72);

    const { getCleanupSettings } = await import('@/lib/server/settings/cleanup');
    const s = getCleanupSettings({ dataDir });
    expect(s.enabled).toBe(false);
    expect(s.thresholdHours).toBe(72);
  });

  it('eligible-count returns the live preview number under the active threshold', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    await insertOrphan(dataDir, ctx.babyId, ctx.ownerId, 50); // eligible (>24h)
    await insertOrphan(dataDir, ctx.babyId, ctx.ownerId, 50); // eligible
    await insertOrphan(dataDir, ctx.babyId, ctx.ownerId, 1); // too young

    mockSession(ctx.ownerId);
    const mod = await import('@/app/api/settings/media-cleanup/eligible-count/route');
    const res = await mod.GET(req(COUNT_URL, 'GET'));
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(2);
  });
});
