import { test, expect } from '@playwright/test';
import { seedE2eExtras } from './fixtures';

test.describe('GET /api/babies/[id] permission gating', () => {
  let babyId: string;
  let strangerCreds: { email: string; password: string };

  test.beforeAll(async () => {
    const seed = await seedE2eExtras();
    babyId = seed.babyId;
    strangerCreds = seed.strangerCreds;
  });

  test('unauthenticated → 401', async () => {
    const res = await fetch(`http://localhost:3000/api/babies/${babyId}`, {
      headers: { cookie: 'invalid=1' }
    });
    expect(res.status).toBe(401);
  });

  test('owner authenticated → 200 with baby payload', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.get(`/api/babies/${babyId}`, {
      headers: { cookie: cookieHeader }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(babyId);
    expect(body.name).toBe('E2E Baby');
  });

  test('non-family user → 404 (not 403)', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: strangerCreds
    });
    expect(signIn.status()).toBeLessThan(400);

    const res = await request.get(`/api/babies/${babyId}`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  test('invalid-shape id → 404', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.get('/api/babies/not-a-uuid', {
      headers: { cookie: cookieHeader }
    });
    expect(res.status()).toBe(404);
  });

  test('unknown UUID → 404', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await request.get('/api/babies/00000000-0000-0000-0000-000000000000', {
      headers: { cookie: cookieHeader }
    });
    expect(res.status()).toBe(404);
  });
});
