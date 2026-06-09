import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { resetDbForTesting } from '../../lib/server/db/client';
import { seedE2eExtras } from './fixtures';

// The dev server applies migrations + bootstraps the owner during ensureStartup,
// which the /api/health route awaits. Block on a healthy response, then read the
// shared DB from the test process to seed baby + stranger.
async function ensureSeeded(request: APIRequestContext) {
  // Retry the whole health-nudge + direct-DB seed until the server has migrated
  // and bootstrapped the shared SQLite file (seedE2eExtras throws until then).
  await expect(async () => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    resetDbForTesting();
    await seedE2eExtras();
  }).toPass({ timeout: 40_000, intervals: [500, 1000, 2000, 3000] });
}

async function signInOwner(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'e2eowner');
  await page.fill('input[name="password"]', 'e2epassword');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding\/baby|timeline).*$/);

  if (page.url().includes('/onboarding/baby')) {
    await page.fill('input[name="name"]', 'E2E Baby');
    await page.getByRole('button', { name: '选择生日' }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '开始记录' }).click();
    await page.waitForURL('**/timeline*');
  }
}

test.describe('media cleanup panel (owner)', () => {
  // Ensure a baby exists so owner login lands on /timeline instead of the
  // onboarding flow (matches how the broader e2e run avoids onboarding).
  test.beforeAll(async ({ request }) => {
    await ensureSeeded(request);
  });

  test('owner opens the cleanup panel from profile and sees the controls', async ({ page }) => {
    await signInOwner(page);

    await page.goto('/profile');
    await page.getByRole('link', { name: '媒体清理' }).click();
    await page.waitForURL('**/profile/cleanup');

    await expect(page.getByRole('heading', { name: '媒体清理' })).toBeVisible();
    await expect(page.getByRole('switch', { name: '自动清理开关' })).toBeVisible();
    await expect(page.getByRole('spinbutton')).toBeVisible();
    await expect(page.getByRole('button', { name: '立即清理' })).toBeVisible();
    await expect(page.getByText('待清理')).toBeVisible();
    await expect(page.getByText('上次运行')).toBeVisible();
  });

  test('out-of-range threshold shows an inline error and disables save', async ({ page }) => {
    await signInOwner(page);
    await page.goto('/profile/cleanup');

    await page.getByRole('spinbutton').fill('3');
    await expect(page.getByText('请输入 6–720 之间的整数小时')).toBeVisible();
    await expect(page.getByRole('button', { name: '保存时长' })).toBeDisabled();
  });

  test('owner saves an in-range threshold and it persists across reload', async ({ page }) => {
    await signInOwner(page);
    await page.goto('/profile/cleanup');

    await page.getByRole('spinbutton').fill('48');
    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/settings/media-cleanup') && r.request().method() === 'PUT'
      ),
      page.getByRole('button', { name: '保存时长' }).click()
    ]);
    expect(putResp.status()).toBe(200);

    await page.reload();
    await expect(page.getByRole('spinbutton')).toHaveValue('48');
  });

  test('owner triggers a manual run and the endpoint returns 200 with feedback', async ({ page }) => {
    await signInOwner(page);
    await page.goto('/profile/cleanup');

    const [runResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/settings/media-cleanup/run') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: '立即清理' }).click()
    ]);
    expect(runResp.status()).toBe(200);
    await expect(page.getByText(/已清理 \d+ 个/)).toBeVisible();
  });
});

test.describe('media cleanup governance (member denied)', () => {
  let strangerCreds: { email: string; password: string };

  test.beforeAll(async ({ request }) => {
    await ensureSeeded(request);
    strangerCreds = (await seedE2eExtras()).strangerCreds;
  });

  test('a member gets 404 on every cleanup endpoint and mutates nothing', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', { data: strangerCreds });
    expect(signIn.status()).toBeLessThan(400);

    // The request context now carries the member session cookie.
    expect((await request.get('/api/settings/media-cleanup')).status()).toBe(404);
    expect(
      (await request.put('/api/settings/media-cleanup', { data: { enabled: false } })).status()
    ).toBe(404);
    expect((await request.post('/api/settings/media-cleanup/run')).status()).toBe(404);
    expect((await request.get('/api/settings/media-cleanup/eligible-count')).status()).toBe(404);
  });
});
