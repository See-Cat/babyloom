import { expect, test } from '@playwright/test';

test('calendar tab opens the month grid and day links to timeline', async ({ page }) => {
  await signInWithBaby(page);

  await page.getByRole('link', { name: /日历/ }).click();
  await page.waitForURL('**/calendar');
  await expect(page.getByRole('heading', { name: '日历' })).toBeVisible();

  await page.getByRole('link', { name: '上一月' }).click();
  await expect(page).toHaveURL(/\/calendar\?babyId=.*&ym=\d{4}-\d{2}/);

  const firstDay = page.locator('[role="gridcell"] a').first();
  await firstDay.click();
  await expect(page).toHaveURL(/\/timeline\?babyId=.*&date=\d{4}-\d{2}-\d{2}/);
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
