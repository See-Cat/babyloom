import { expect, test } from '@playwright/test';

test('P5 dialog supports keyboard close and focus restore', async ({ page }) => {
  await page.goto('/components');

  const trigger = page.getByRole('button', { name: '打开 Dialog' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '确认操作' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '确认操作' })).toBeHidden();
  await expect(trigger).toBeFocused();
});
