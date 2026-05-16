import { test, expect } from '@playwright/test';

async function signInAsOwner(request: any) {
  const res = await request.post('/api/auth/sign-in/email', {
    data: { email: 'e2eowner@local.babyloom', password: 'e2epassword' }
  });
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies
    .split(/,(?=\s*\w+=)/)
    .map((c: string) => c.split(';')[0].trim())
    .join('; ');
}

test.describe.serial('entry edit', () => {
  let cookie: string;
  let babyId: string;
  let entryId: string;
  let milestoneId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
    const babies = await (await request.get('/api/babies', { headers: { cookie } })).json();
    if (babies.babies.length > 0) {
      babyId = babies.babies[0].id;
    } else {
      const baby = await request.post('/api/babies', {
        headers: { cookie, 'content-type': 'application/json' },
        data: { name: 'Entry Edit Baby', birthday: '2024-01-01', gender: 'girl' }
      });
      babyId = (await baby.json()).id;
    }
    const ms = await request.post('/api/milestones', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'Test MS', icon: 'star' }
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

  test('viewer cannot PATCH entry (404)', async ({ request }) => {
    await request.post('/api/family-members', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { username: 'eeview', password: 'eeviewpass1', nickname: 'EE-View', role: 'viewer' }
    });
    const r = await request.post('/api/auth/sign-in/email', {
      data: { email: 'eeview@local.babyloom', password: 'eeviewpass1' }
    });
    const sc = r.headers()['set-cookie'] ?? '';
    const viewerCookie = sc
      .split(/,(?=\s*\w+=)/)
      .map((c: string) => c.split(';')[0].trim())
      .join('; ');

    const res = await request.patch(`/api/entries/${entryId}`, {
      headers: { cookie: viewerCookie, 'content-type': 'application/json' },
      data: { content: 'viewer tries to edit' }
    });
    expect(res.status()).toBe(404);
  });

  test("editor cannot PATCH another author's entry (404)", async ({ request }) => {
    await request.post('/api/family-members', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { username: 'eeedit', password: 'eeeditpass1', nickname: 'EE-Edit', role: 'editor' }
    });
    const r = await request.post('/api/auth/sign-in/email', {
      data: { email: 'eeedit@local.babyloom', password: 'eeeditpass1' }
    });
    const sc = r.headers()['set-cookie'] ?? '';
    const editorCookie = sc
      .split(/,(?=\s*\w+=)/)
      .map((c: string) => c.split(';')[0].trim())
      .join('; ');

    const res = await request.patch(`/api/entries/${entryId}`, {
      headers: { cookie: editorCookie, 'content-type': 'application/json' },
      data: { content: 'editor tries to hijack' }
    });
    expect(res.status()).toBe(404);
  });
});
