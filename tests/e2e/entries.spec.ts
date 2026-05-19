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

test.describe.serial('entries API', () => {
  let cookie: string;
  let babyId: string;
  let entryId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
    const baby = await request.post('/api/babies', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { name: 'Entries API Baby', birthday: '2024-07-01', gender: 'other' }
    });
    expect(baby.status()).toBe(201);
    const body = await baby.json();
    babyId = body.id;
  });

  test('create entry', async ({ request }) => {
    const res = await request.post('/api/entries', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { babyId, content: 'hello world' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.babyId).toBe(babyId);
    entryId = body.id;
  });

  test('list entries returns the new one', async ({ request }) => {
    const res = await request.get(`/api/entries?babyId=${babyId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.entries.some((entry: any) => entry.id === entryId)).toBe(true);
  });

  test('GET single entry', async ({ request }) => {
    const res = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.content).toBe('hello world');
  });

  test('PATCH single entry', async ({ request }) => {
    const res = await request.patch(`/api/entries/${entryId}`, {
      headers: { cookie, 'content-type': 'application/json' },
      data: { content: 'hello world edited' }
    });
    expect(res.status()).toBe(200);
    const get = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    const body = await get.json();
    expect(body.content).toBe('hello world edited');
  });

  test('trash removes from list', async ({ request }) => {
    const trash = await request.post(`/api/entries/${entryId}/trash`, { headers: { cookie } });
    expect(trash.status()).toBe(200);
    const list = await request.get(`/api/entries?babyId=${babyId}`, { headers: { cookie } });
    const body = await list.json();
    expect(body.entries.some((entry: any) => entry.id === entryId)).toBe(false);
  });

  test('GET trashed entry returns 404 (status gate)', async ({ request }) => {
    const res = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(res.status()).toBe(404);
  });

  test('restore brings it back', async ({ request }) => {
    const res = await request.post(`/api/entries/${entryId}/restore`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get(`/api/entries?babyId=${babyId}`, { headers: { cookie } });
    const body = await list.json();
    expect(body.entries.some((entry: any) => entry.id === entryId)).toBe(true);
  });

  test('purge succeeds after trash', async ({ request }) => {
    const trash = await request.post(`/api/entries/${entryId}/trash`, { headers: { cookie } });
    expect(trash.status()).toBe(200);
    const res = await request.delete(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const get = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(get.status()).toBe(404);
  });
});
