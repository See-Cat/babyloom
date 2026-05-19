import { expect, test } from '@playwright/test';

test('profile links to my profile and saves the display name', async ({ page }) => {
  await signInWithBaby(page);

  await page.goto('/profile');
  await page.getByRole('link', { name: '我的资料' }).click();
  await page.waitForURL('**/profile/me');

  await expect(page.getByRole('heading', { name: '我的资料' })).toBeVisible();
  await page.fill('input[name="name"]', 'E2E Owner Updated');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('已保存')).toBeVisible();

  await page.reload();
  await expect(page.locator('input[name="name"]')).toHaveValue('E2E Owner Updated');
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
