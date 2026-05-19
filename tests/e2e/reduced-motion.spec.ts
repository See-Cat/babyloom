import { expect, test } from '@playwright/test';

test('P5 reduced motion disables tokenized durations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/components');

  const durations = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return [
      styles.getPropertyValue('--duration-fast').trim(),
      styles.getPropertyValue('--duration-normal').trim(),
      styles.getPropertyValue('--duration-slow').trim()
    ];
  });

  expect(durations).toEqual(['0ms', '0ms', '0ms']);
});
