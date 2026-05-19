import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1024, height: 900 }
];

async function signInWithBaby(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'e2eowner');
  await page.fill('input[name="password"]', 'e2epassword');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding\/baby|timeline)$/);

  if (page.url().includes('/onboarding/baby')) {
    await page.fill('input[name="name"]', '视觉宝宝');
    await page.fill('input[name="birthday"]', '2024-01-01');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/timeline$/);
  }
}

test.describe('P5 visual regression', () => {
  for (const viewport of breakpoints) {
    test(`public screens @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'BabyLoom' })).toBeVisible();
      await expect(page).toHaveScreenshot(`login-${viewport.name}.png`, { fullPage: true });

      await page.goto('/components');
      await expect(page.getByRole('heading', { name: 'Button' })).toBeVisible();
      await expect(page).toHaveScreenshot(`components-${viewport.name}.png`, { fullPage: true });

      await page.getByRole('button', { name: '打开 Dialog' }).click();
      await expect(page.getByRole('dialog', { name: '确认操作' })).toBeVisible();
      await expect(page).toHaveScreenshot(`components-dialog-${viewport.name}.png`, { fullPage: true });
    });

    test(`signed-in screens @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signInWithBaby(page);

      const paths = [
        ['timeline', '/timeline', /时间线/],
        ['entry-new', '/entry/new', /写一条记录/],
        ['profile', '/profile', /家庭设置/],
        ['profile-babies', '/profile/babies', /宝宝管理/],
        ['profile-members', '/profile/members', /成员管理/],
        ['profile-milestones', '/profile/milestones', /里程碑管理/],
        ['profile-trash', '/profile/trash', /垃圾桶/]
      ] as const;

      for (const [name, path, heading] of paths) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
        await expect(page).toHaveScreenshot(`${name}-${viewport.name}.png`, { fullPage: true });
      }
    });
  }
});
