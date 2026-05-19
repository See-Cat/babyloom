import { test, expect } from '@playwright/test';
import { resetE2eDomainData } from './fixtures';

test.describe.serial('main flow: login → onboarding → create baby → write entry → see in timeline', () => {
  test.beforeAll(async () => {
    await resetE2eDomainData();
  });

  test('owner end-to-end', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/onboarding/baby');

    await page.fill('input[name="name"]', 'E2E Baby');
    await page.fill('input[name="birthday"]', '2024-01-01');
    await page.selectOption('select[name="gender"]', 'girl');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/timeline*');
    await expect(page.getByText('还没有记录')).toBeVisible();

    await page.click('text=+ 新记录');
    await page.waitForURL('**/entry/new*');
    await page.fill('textarea[name="content"]', '今天宝宝第一次笑了!');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/entry\/[0-9a-f-]+$/);
    await expect(page.getByText('今天宝宝第一次笑了!')).toBeVisible();

    await page.goto('/timeline');
    await expect(page.getByText('今天宝宝第一次笑了!')).toBeVisible();
  });

  test('second visit goes straight to timeline (not onboarding)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/timeline*');
  });
});
