import { writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function runA11y(page: any, name: string, report: string[]) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious'
  );
  const advisory = results.violations.filter((violation) =>
    violation.impact === 'moderate' || violation.impact === 'minor'
  );

  if (advisory.length > 0) {
    report.push(`## ${name}`);
    for (const violation of advisory) {
      report.push(`- ${violation.impact}: ${violation.id} - ${violation.help}`);
    }
  }

  expect(blocking, `${name} has no critical/serious axe violations`).toEqual([]);
}

async function signIn(page: any) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'e2eowner');
  await page.fill('input[name="password"]', 'e2epassword');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding\/baby|timeline)$/);
}

async function createBabyAndEntry(page: any) {
  const baby = await page.request.post('/api/babies', {
    data: { name: 'A11y Baby', birthday: '2024-01-01', gender: 'other' }
  });
  expect(baby.status()).toBe(201);
  const babyBody = await baby.json();

  const entry = await page.request.post('/api/entries', {
    data: { babyId: babyBody.id, content: 'A11y smoke entry' }
  });
  expect(entry.status()).toBe(201);
  const entryBody = await entry.json();

  return { babyId: babyBody.id, entryId: entryBody.id };
}

test('P5 pages have no critical or serious axe violations', async ({ page }) => {
  const report: string[] = ['# P5 a11y advisory report', ''];

  await page.goto('/login');
  await runA11y(page, '/login', report);

  await signIn(page);
  await page.goto('/onboarding/baby');
  await runA11y(page, '/onboarding/baby', report);

  const { babyId, entryId } = await createBabyAndEntry(page);
  const signedInPages = [
    ['/timeline', /时光/],
    [`/entry/new?babyId=${babyId}`, /新记录/],
    [`/entry/${entryId}`, /记录/],
    [`/entry/${entryId}/edit`, /编辑记录/],
    ['/profile', /我的/],
    ['/profile/members', /家庭成员/],
    ['/profile/milestones', /里程碑设置/],
    ['/profile/trash', /垃圾桶/]
  ] as const;

  for (const [path, heading] of signedInPages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await runA11y(page, path, report);
  }

  await page.goto('/components');
  await expect(page.getByRole('heading', { name: 'Button' })).toBeVisible();
  await runA11y(page, '/components', report);

  await page.getByRole('button', { name: '打开 Modal' }).first().click();
  await expect(page.getByRole('dialog', { name: '确认删除这条记录？' })).toBeVisible();
  await page.waitForTimeout(300);
  await runA11y(page, '/components modal', report);

  if (report.length === 2) {
    report.push('No moderate or minor violations.');
  }
  writeFileSync('tests/e2e/a11y-report.md', `${report.join('\n')}\n`);
});
