import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedOwnerBabyEntries } from '@/tests/fixtures/seed';

function jsonReq(url: string, method: string, body?: unknown): any {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe('PATCH /api/family-members/[id]', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'babyloom-fm-id-patch-'));
    process.env.BABYLOOM_DATA_DIR = dataDir;
  });

  afterEach(() => {
    vi.doUnmock('@/lib/permissions/session');
    vi.resetModules();
    delete process.env.BABYLOOM_DATA_DIR;
  });

  async function seedMember(username: string) {
    const { POST } = await import('@/app/api/family-members/route');
    const res = await POST(
      jsonReq('http://localhost/api/family-members', 'POST', {
        username,
        password: 'password1234',
        nickname: 'Target'
      }) as any
    );
    return await res.json();
  }

  it('rejects role field with 400', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const target = await seedMember('targ01');

    const { PATCH } = await import('@/app/api/family-members/[id]/route');
    const url = `http://localhost/api/family-members/${target.userId}`;
    const res = await PATCH(
      jsonReq(url, 'PATCH', { role: 'editor' }) as any,
      { params: Promise.resolve({ id: target.userId }) } as any
    );
    expect(res.status).toBe(400);
  });

  it('password update: 200, password reset', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const target = await seedMember('targ02');

    const { PATCH } = await import('@/app/api/family-members/[id]/route');
    const url = `http://localhost/api/family-members/${target.userId}`;
    const res = await PATCH(
      jsonReq(url, 'PATCH', { password: 'newpass1234' }) as any,
      { params: Promise.resolve({ id: target.userId }) } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(target.userId);
  });

  it('empty body: 400', async () => {
    const ctx = await seedOwnerBabyEntries(dataDir);
    vi.doMock('@/lib/permissions/session', () => ({
      getSessionUserId: async () => ctx.ownerId
    }));
    const target = await seedMember('targ03');

    const { PATCH } = await import('@/app/api/family-members/[id]/route');
    const url = `http://localhost/api/family-members/${target.userId}`;
    const res = await PATCH(
      jsonReq(url, 'PATCH', {}) as any,
      { params: Promise.resolve({ id: target.userId }) } as any
    );
    expect(res.status).toBe(400);
  });
});
