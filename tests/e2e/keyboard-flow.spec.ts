import { expect, test } from '@playwright/test';

test('P5 modal supports keyboard close and focus restore', async ({ page }) => {
  await page.goto('/components');

  const trigger = page.getByRole('button', { name: '打开 Modal' }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '确认删除这条记录？' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '确认删除这条记录？' })).toBeHidden();
  await expect(trigger).toBeFocused();
});
