import { test, expect } from '@playwright/test';

test('unauthenticated visit redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('owner can log in with config credentials', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'e2e@example.com');
  await page.fill('input[name="password"]', 'e2epassword');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Babyloom' })).toBeVisible();
});

test('wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'e2e@example.com');
  await page.fill('input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await expect(page.getByText('邮箱或密码错误')).toBeVisible();
});

test('health endpoint returns ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.dbReady).toBe(true);
});
