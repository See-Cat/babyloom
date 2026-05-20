import { expect, test } from '@playwright/test';

async function signInAs(request: any, email: string, password: string) {
  const res = await request.post('/api/auth/sign-in/email', {
    headers: { origin: 'http://localhost:3000' },
    data: { email, password }
  });
  expect(res.status(), await res.text()).toBeLessThan(400);
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies
    .split(/,(?=\s*\w+=)/)
    .map((cookie: string) => cookie.split(';')[0].trim())
    .join('; ');
}

test.describe.serial('permissions matrix UI', () => {
  let ownerCookie: string;
  let editorCookie: string;
  let babyId: string;
  let entryId: string;

  test.beforeAll(async ({ request }) => {
    ownerCookie = await signInAs(request, 'e2eowner@local.babyloom', 'e2epassword');

    const member = await request.post('/api/family-members', {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: {
        username: 'p8editor',
        password: 'p8editorpass123',
        nickname: 'P8 Editor',
        role: 'editor'
      }
    });
    expect(member.status()).toBe(201);
    editorCookie = await signInAs(request, 'p8editor@local.babyloom', 'p8editorpass123');

    const viewer = await request.post('/api/family-members', {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: {
        username: 'p8viewer',
        password: 'p8viewerpass123',
        nickname: 'P8 Viewer',
        role: 'viewer'
      }
    });
    expect(viewer.status()).toBe(201);

    const baby = await request.post('/api/babies', {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { name: 'P8 UI Baby', birthday: '2024-08-01', gender: 'other' }
    });
    expect(baby.status()).toBe(201);
    babyId = (await baby.json()).id;

    const hiddenBaby = await request.post('/api/babies', {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { name: 'P8 Hidden Baby', birthday: '2024-09-01', gender: 'other' }
    });
    expect(hiddenBaby.status()).toBe(201);

    const entry = await request.post('/api/entries', {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { babyId, content: 'P8 purge invariant' }
    });
    expect(entry.status()).toBe(201);
    entryId = (await entry.json()).id;

    const trash = await request.post(`/api/entries/${entryId}/trash`, {
      headers: { cookie: ownerCookie }
    });
    expect(trash.status()).toBe(200);
  });

  test('canDelete override does not grant editor purge', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(onboarding\/baby|timeline)$/);

    await page.goto('/profile/members/permissions');
    await expect(page.getByRole('heading', { name: '宝宝权限' })).toBeVisible();
    await page.getByRole('switch', { name: 'P8 Editor P8 UI Baby 写' }).click();
    await expect(page.getByRole('switch', { name: 'P8 Editor P8 UI Baby 删' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    const purge = await request.delete(`/api/entries/${entryId}`, {
      headers: { cookie: editorCookie }
    });
    expect(purge.status()).toBe(404);
  });

  test('canRead override hides a baby from viewer tabs', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'e2eowner');
    await page.fill('input[name="password"]', 'e2epassword');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(onboarding\/baby|timeline)$/);

    await page.goto('/profile/members/permissions');
    await page.getByRole('switch', { name: 'P8 Viewer P8 Hidden Baby 看' }).click();
    await expect(page.getByRole('switch', { name: 'P8 Viewer P8 Hidden Baby 看' })).toHaveAttribute(
      'aria-checked',
      'false'
    );

    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="username"]', 'p8viewer');
    await page.fill('input[name="password"]', 'p8viewerpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/timeline$/);

    for (const path of ['/timeline', '/gallery', '/calendar']) {
      await page.goto(path);
      await expect(page.getByText('P8 Hidden Baby')).toHaveCount(0);
    }
  });
});
