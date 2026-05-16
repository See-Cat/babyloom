import { test, expect } from '@playwright/test';

async function signInAsOwner(request: any) {
  const res = await request.post('/api/auth/sign-in/email', {
    data: { email: 'e2eowner@local.babyloom', password: 'e2epassword' }
  });
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies
    .split(/,(?=\s*\w+=)/)
    .map((cookie: string) => cookie.split(';')[0].trim())
    .join('; ');
}

test.describe.serial('babies API', () => {
  let cookie: string;
  let babyId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
  });

  test('owner can create a baby', async ({ request }) => {
    const res = await request.post('/api/babies', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'API Baby', birthday: '2024-06-01', gender: 'boy' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('API Baby');
    babyId = body.id;
  });

  test('GET /api/babies lists active babies', async ({ request }) => {
    const res = await request.get('/api/babies', { headers: { cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.babies.some((baby: any) => baby.id === babyId)).toBe(true);
  });

  test('PATCH /api/babies/[id] updates fields', async ({ request }) => {
    const res = await request.patch(`/api/babies/${babyId}`, {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'API Baby Updated' }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('API Baby Updated');
  });

  test('soft-delete moves baby out of list', async ({ request }) => {
    const res = await request.post(`/api/babies/${babyId}/trash`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/babies', { headers: { cookie } });
    const body = await list.json();
    expect(body.babies.some((baby: any) => baby.id === babyId)).toBe(false);
  });

  test('restore brings baby back', async ({ request }) => {
    const res = await request.post(`/api/babies/${babyId}/restore`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/babies', { headers: { cookie } });
    const body = await list.json();
    expect(body.babies.some((baby: any) => baby.id === babyId)).toBe(true);
  });

  test('purge requires trashed status — 404 on active', async ({ request }) => {
    const res = await request.delete(`/api/babies/${babyId}`, { headers: { cookie } });
    expect(res.status()).toBe(404);
  });

  test('purge succeeds after trash when no active child entries remain', async ({ request }) => {
    const trash = await request.post(`/api/babies/${babyId}/trash`, { headers: { cookie } });
    expect(trash.status()).toBe(200);
    const res = await request.delete(`/api/babies/${babyId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/babies', { headers: { cookie } });
    const body = await list.json();
    expect(body.babies.some((baby: any) => baby.id === babyId)).toBe(false);
  });
});
