import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const JPEG = join(__dirname, '..', 'fixtures', 'media', '2x2.jpg');
const SVG = join(__dirname, '..', 'fixtures', 'media', 'evil.svg');
const HTML_AS_JPG = join(__dirname, '..', 'fixtures', 'media', 'evil-html-as.jpg');

async function signInAsOwner(request: any) {
  const res = await request.post('/api/auth/sign-in/email', {
    data: { email: 'e2eowner@local.babyloom', password: 'e2epassword' }
  });
  expect(res.status()).toBeLessThan(400);
  const setCookies = res.headers()['set-cookie'] ?? '';
  return setCookies
    .split(/,(?=\s*\w+=)/)
    .map((cookie: string) => cookie.split(';')[0].trim())
    .join('; ');
}

async function createBaby(request: any, cookie: string, name: string) {
  const res = await request.post('/api/babies', {
    headers: { cookie, 'content-type': 'application/json' },
    data: { name, birthday: '2025-01-01', gender: 'other' }
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

async function createEntry(request: any, cookie: string, babyId: string, content = 'media entry') {
  const res = await request.post('/api/entries', {
    headers: { cookie, 'content-type': 'application/json' },
    data: { babyId, content }
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

async function upload(
  request: any,
  cookie: string,
  args: { babyId: string; clientUploadId: string; path: string; filename: string; entryId?: string }
) {
  const multipart: Record<string, any> = {
    babyId: args.babyId,
    clientUploadId: args.clientUploadId,
    file: {
      name: args.filename,
      mimeType: 'application/octet-stream',
      buffer: readFileSync(args.path)
    }
  };
  if (args.entryId) multipart.entryId = args.entryId;
  const res = await request.post('/api/media/upload', { headers: { cookie }, multipart });
  return res;
}

test.describe.serial('P3 media API', () => {
  let cookie: string;
  let babyId: string;

  test.beforeAll(async ({ request }) => {
    cookie = await signInAsOwner(request);
    babyId = await createBaby(request, cookie, 'Media Baby');
  });

  test('uploads a photo, attaches it, and serves hardened variants', async ({ request }) => {
    const entryId = await createEntry(request, cookie, babyId, 'first photo');
    const uploaded = await upload(request, cookie, {
      babyId,
      entryId,
      clientUploadId: crypto.randomUUID(),
      path: JPEG,
      filename: '2x2.jpg'
    });
    expect(uploaded.status()).toBe(200);
    const { mediaId } = await uploaded.json();

    const entry = await request.get(`/api/entries/${entryId}`, { headers: { cookie } });
    expect(entry.status()).toBe(200);
    expect((await entry.json()).mediaIds).toContain(mediaId);

    const thumb = await request.get(`/api/media/${mediaId}?size=thumb`, { headers: { cookie } });
    expect(thumb.status()).toBe(200);
    expect(thumb.headers()['content-type']).toBe('image/webp');
    expect(thumb.headers()['x-content-type-options']).toBe('nosniff');
    expect(thumb.headers()['content-security-policy']).toMatch(/sandbox/);

    const original = await request.get(`/api/media/${mediaId}?size=original`, { headers: { cookie } });
    expect(original.status()).toBe(200);
    expect(original.headers()['content-type']).toBe('image/jpeg');
    expect(original.headers()['content-disposition']).toMatch(/^attachment;/);
  });

  test('clientUploadId retry and server hash dedupe are idempotent', async ({ request }) => {
    const retryId = crypto.randomUUID();
    const first = await upload(request, cookie, {
      babyId,
      clientUploadId: retryId,
      path: JPEG,
      filename: 'retry.jpg'
    });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();

    const retry = await upload(request, cookie, {
      babyId,
      clientUploadId: retryId,
      path: JPEG,
      filename: 'retry.jpg'
    });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).mediaId).toBe(firstBody.mediaId);

    const deduped = await upload(request, cookie, {
      babyId,
      clientUploadId: crypto.randomUUID(),
      path: JPEG,
      filename: 'same-bytes.jpg'
    });
    expect(deduped.status()).toBe(200);
    const dedupeBody = await deduped.json();
    expect(dedupeBody.mediaId).toBe(firstBody.mediaId);
    expect(dedupeBody.deduplicated).toBe(true);
  });

  test('rejects hostile MIME payloads', async ({ request }) => {
    const svg = await upload(request, cookie, {
      babyId,
      clientUploadId: crypto.randomUUID(),
      path: SVG,
      filename: 'fake.png'
    });
    expect(svg.status()).toBe(422);

    const html = await upload(request, cookie, {
      babyId,
      clientUploadId: crypto.randomUUID(),
      path: HTML_AS_JPG,
      filename: 'fake.jpg'
    });
    expect(html.status()).toBe(422);
  });

  test('trash, restore, and purge media', async ({ request }) => {
    const uploaded = await upload(request, cookie, {
      babyId,
      clientUploadId: crypto.randomUUID(),
      path: JPEG,
      filename: 'trash.jpg'
    });
    expect(uploaded.status()).toBe(200);
    const { mediaId } = await uploaded.json();

    const trash = await request.post(`/api/media/${mediaId}/trash`, { headers: { cookie } });
    expect(trash.status()).toBe(200);
    expect((await request.get(`/api/media/${mediaId}?size=thumb`, { headers: { cookie } })).status()).toBe(404);

    const restore = await request.post(`/api/media/${mediaId}/restore`, { headers: { cookie } });
    expect(restore.status()).toBe(200);
    expect((await request.get(`/api/media/${mediaId}?size=thumb`, { headers: { cookie } })).status()).toBe(200);

    await request.post(`/api/media/${mediaId}/trash`, { headers: { cookie } });
    const purge = await request.delete(`/api/media/${mediaId}`, { headers: { cookie } });
    expect(purge.status()).toBe(200);
    expect((await request.delete(`/api/media/${mediaId}`, { headers: { cookie } })).status()).toBe(404);
  });
});
