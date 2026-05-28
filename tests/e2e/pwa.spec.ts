import { expect, test } from '@playwright/test';

test('manifest is reachable and installable', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);

  const manifest = await res.json();
  expect(manifest.name).toBe('小日子 Babyloom');
  expect(manifest.short_name).toBe('小日子');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/timeline');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }),
      expect.objectContaining({ src: '/icons/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' })
    ])
  );
});
