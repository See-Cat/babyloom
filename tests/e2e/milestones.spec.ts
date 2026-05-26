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

  test('owner edits a custom milestone from the admin page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(timeline|onboarding\/baby)/);
    await page.goto('/profile/milestones');
    const item = page.locator('li').filter({ hasText: 'First word' });
    await item.getByRole('button', { name: '编辑' }).click();
    await page.getByPlaceholder('名称').fill('First phrase');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('First phrase')).toBeVisible();
  });

  test('owner deletes the milestone', async ({ request }) => {
    const res = await request.delete(`/api/milestones/${milestoneId}`, { headers: { cookie } });
    expect(res.status()).toBe(200);
    const list = await request.get('/api/milestones', { headers: { cookie } });
    const body = await list.json();
    expect(body.milestones.some((m: any) => m.id === milestoneId)).toBe(false);
  });

  test('non-owner member cannot create a milestone (404, not 403)', async ({ request }) => {
    // milestone:manage is owner-only regardless of per-baby permissions.
    await request.post('/api/family-members', {
      headers: { cookie, 'content-type': 'application/json' },
      data: { username: 'msmember', password: 'msmemberpass1', nickname: 'MS-Member' }
    });
    const r = await request.post('/api/auth/sign-in/email', {
      data: { email: 'msmember@local.babyloom', password: 'msmemberpass1' }
    });
    const sc = r.headers()['set-cookie'] ?? '';
    const memberCookie = sc
      .split(/,(?=\s*\w+=)/)
      .map((c: string) => c.split(';')[0].trim())
      .join('; ');
    const res = await request.post('/api/milestones', {
      headers: { cookie: memberCookie, 'content-type': 'application/json' },
      data: { name: 'Member attempt', icon: 'no' }
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });
});
