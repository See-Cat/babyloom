import { expect, test } from '@playwright/test';

test('timeline responses include baseline security headers', async ({ request }) => {
  const res = await request.get('/timeline');

  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(res.headers()['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(res.headers()['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
});
