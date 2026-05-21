import { expect, test } from '@playwright/test';

test('owner opens data export from profile', async ({ page }) => {
  await signInWithBaby(page);

  await page.goto('/profile');
  await page.getByRole('link', { name: '数据导出 / 备份' }).click();
  await page.waitForURL('**/profile/data');

  await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出全部' })).toBeVisible();
  await expect(page.getByRole('link', { name: '查看系统日志' })).toBeVisible();
});

async function signInWithBaby(page: any) {
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
