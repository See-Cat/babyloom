import { test, expect } from '@playwright/test';

test('unauthenticated visit redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('owner can log in with config credentials', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'e2eowner');
  await page.fill('input[name="password"]', 'e2epassword');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding\/baby|timeline)$/);
  await expect(page.getByRole('heading', { name: /第一个宝宝|时间线/ })).toBeVisible();
});

test('wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'e2eowner');
  await page.fill('input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await expect(page.getByText('用户名或密码错误')).toBeVisible();
});

test('health endpoint returns ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.dbReady).toBe(true);
});
