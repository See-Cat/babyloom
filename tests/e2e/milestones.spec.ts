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

test.describe.serial('milestones', () => {
  let cookie: string;
  let milestoneId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
  });

  test('owner creates a custom milestone', async ({ request }) => {
    const res = await request.post('/api/milestones', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'First word', icon: 'talk' }
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

  test('editor cannot create a milestone (404, not 403)', async ({ request }) => {
    await request.post('/api/family-members', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { username: 'msedit', password: 'mseditpass1', nickname: 'MS-Edit', role: 'editor' }
    });
    const r = await request.post('/api/auth/sign-in/email', {
      data: { email: 'msedit@local.babyloom', password: 'mseditpass1' }
    });
    const sc = r.headers()['set-cookie'] ?? '';
    const editorCookie = sc
      .split(/,(?=\s*\w+=)/)
      .map((c: string) => c.split(';')[0].trim())
      .join('; ');
    const res = await request.post('/api/milestones', {
      headers: { cookie: editorCookie, 'content-type': 'application/json' },
      data: { name: 'Editor attempt', icon: 'no' }
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  test('viewer cannot create a milestone (404)', async ({ request }) => {
    await request.post('/api/family-members', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { username: 'msview', password: 'msviewpass1', nickname: 'MS-View', role: 'viewer' }
    });
    const r = await request.post('/api/auth/sign-in/email', {
      data: { email: 'msview@local.babyloom', password: 'msviewpass1' }
    });
    const sc = r.headers()['set-cookie'] ?? '';
    const viewerCookie = sc
      .split(/,(?=\s*\w+=)/)
      .map((c: string) => c.split(';')[0].trim())
      .join('; ');
    const res = await request.post('/api/milestones', {
      headers: { cookie: viewerCookie, 'content-type': 'application/json' },
      data: { name: 'Viewer attempt', icon: 'no' }
    });
    expect(res.status()).toBe(404);
  });
});
