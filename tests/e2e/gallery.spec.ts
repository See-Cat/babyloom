import { expect, test } from '@playwright/test';

test('gallery tab opens the gallery page', async ({ page }) => {
  await signInWithBaby(page);

  await page.getByRole('link', { name: /画廊/ }).click();
  await page.waitForURL('**/gallery');

  await expect(page.getByRole('heading', { name: '画廊' })).toBeVisible();
  await expect(page.getByText(/还没有照片|年 \d+ 月/)).toBeVisible();
});

async function signInWithBaby(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'e2eowner');
  await page.fill('input[name="password"]', 'e2epassword');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding\/baby|timeline).*$/);

  if (page.url().includes('/onboarding/baby')) {
    await page.fill('input[name="name"]', 'E2E Baby');
    await page.fill('input[name="birthday"]', '2024-01-01');
    await page.selectOption('select[name="gender"]', 'girl');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/timeline*');
  }
}
