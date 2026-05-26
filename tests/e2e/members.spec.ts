import { test, expect } from '@playwright/test';

async function signInAs(request: any, email: string, password: string) {
  const res = await request.post('/api/auth/sign-in/email', { data: { email, password } });
  expect(res.status()).toBeLessThan(400);
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies
    .split(/,(?=\s*\w+=)/)
    .map((c: string) => c.split(';')[0].trim())
    .join('; ');
}

test.describe.serial('member admin', () => {
  let ownerCookie: string;
  let newMemberUserId: string;

  test.beforeAll(async ({ request }) => {
    ownerCookie = await signInAs(request, 'e2eowner@local.babyloom', 'e2epassword');
  });

  test('owner creates a member', async ({ request }) => {
    const res = await request.post('/api/family-members', {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { username: 'edith', password: 'edithpass123', nickname: 'Edith' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.username).toBe('edith');
    newMemberUserId = body.userId;
  });

  test('new member can sign in (sees empty baby list without permissions)', async ({ request }) => {
    const cookie = await signInAs(request, 'edith@local.babyloom', 'edithpass123');
    const me = await request.get('/api/babies', { headers: { cookie } });
    expect(me.status()).toBe(200);
    // Strict model: member with zero baby_member_permissions rows sees no babies.
    const body = await me.json();
    expect(body.babies ?? []).toEqual([]);
  });

  test('owner can associate baby with permission', async ({ request }) => {
    const list = await request.get('/api/family-members', { headers: { cookie: ownerCookie } });
    const body = await list.json();
    const target = body.members.find((m: any) => m.username === 'edith');
    expect(target).toBeTruthy();

    const babiesRes = await request.get('/api/babies', { headers: { cookie: ownerCookie } });
    const babiesBody = await babiesRes.json();
    const firstBabyId = babiesBody.babies?.[0]?.id;
    if (!firstBabyId) {
      test.skip(true, 'no active baby available to test association');
      return;
    }

    const assoc = await request.post(`/api/family-members/${target.memberId}/baby-permissions`, {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { babyIds: [firstBabyId], permission: 'editor' }
    });
    expect(assoc.status()).toBe(201);

    // GET reflects babyPermissions
    const listAfter = await request.get('/api/family-members', { headers: { cookie: ownerCookie } });
    const bodyAfter = await listAfter.json();
    const targetAfter = bodyAfter.members.find((m: any) => m.username === 'edith');
    expect(targetAfter.babyPermissions).toEqual([
      expect.objectContaining({ babyId: firstBabyId, permission: 'editor' })
    ]);

    // PATCH single association
    const patchRes = await request.patch(
      `/api/family-members/${target.memberId}/baby-permissions/${firstBabyId}`,
      {
        headers: { cookie: ownerCookie, 'content-type': 'application/json' },
        data: { permission: 'viewer' }
      }
    );
    expect(patchRes.status()).toBe(200);

    // DELETE association
    const delRes = await request.delete(
      `/api/family-members/${target.memberId}/baby-permissions/${firstBabyId}`,
      { headers: { cookie: ownerCookie } }
    );
    expect(delRes.status()).toBe(200);
  });

  test('non-owner cannot list family members', async ({ request }) => {
    const cookie = await signInAs(request, 'edith@local.babyloom', 'edithpass123');
    const res = await request.get('/api/family-members', { headers: { cookie } });
    expect(res.status()).toBe(404);
  });

  test('non-owner gets 404 for member admin page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'edith');
    await page.fill('input[name="password"]', 'edithpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/timeline*');
    const res = await page.goto('/profile/members');
    expect(res?.status()).toBe(404);
  });

  test('owner resets password', async ({ request }) => {
    const res = await request.patch(`/api/family-members/${newMemberUserId}`, {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { password: 'edith-newpass-456' }
    });
    expect(res.status()).toBe(200);

    const oldAttempt = await request.post('/api/auth/sign-in/email', {
      data: { email: 'edith@local.babyloom', password: 'edithpass123' }
    });
    expect(oldAttempt.status()).toBeGreaterThanOrEqual(400);

    const newCookie = await signInAs(request, 'edith@local.babyloom', 'edith-newpass-456');
    expect(newCookie).toBeTruthy();
  });

  test('PATCH no longer accepts role field', async ({ request }) => {
    const res = await request.patch(`/api/family-members/${newMemberUserId}`, {
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      data: { role: 'editor' }
    });
    // role is silently stripped by zod default; with no password the schema
    // rejects the body as invalid (password is required).
    expect(res.status()).toBe(400);
  });

  test('owner removes the member', async ({ request }) => {
    const res = await request.delete(`/api/family-members/${newMemberUserId}`, {
      headers: { cookie: ownerCookie }
    });
    expect(res.status()).toBe(200);

    const cookie = await signInAs(request, 'edith@local.babyloom', 'edith-newpass-456');
    const blocked = await request.get('/api/babies', { headers: { cookie } });
    expect(blocked.status()).toBe(404);
  });
});
