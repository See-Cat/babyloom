import { test, expect } from '@playwright/test';

async function signInAs(request: any, email: string, password: string) {
  const res = await request.post('/api/auth/sign-in/email', { data: { email, password } });
  expect(res.status()).toBeLessThan(400);
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies
    .split(/,(?=\s*\w+=)/)
    .map((c: string) => c.split(';')[0].trim())
    .join('; ');
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
