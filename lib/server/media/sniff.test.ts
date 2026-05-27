import { describe, expect, test } from 'vitest';
import { MediaUnsupportedError, sniffAndValidate } from '@/lib/server/media/sniff';

const fx = (n: string) => `tests/fixtures/media/${n}`;

describe('sniffAndValidate', () => {
  test('accepts a PNG with dimensions', async () => {
    const result = await sniffAndValidate(fx('1x1.png'));
    expect(result.type).toBe('photo');
    expect(result.mimeType).toBe('image/png');
    expect(result.ext).toBe('png');
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  test('accepts a JPEG', async () => {
    const result = await sniffAndValidate(fx('2x2.jpg'));
    expect(result.type).toBe('photo');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.ext).toBe('jpg');
  });

  test('accepts an mp4 with duration', async () => {
    const result = await sniffAndValidate(fx('mp4-30frames.mp4'));
    expect(result.type).toBe('video');
    expect(result.mimeType).toBe('video/mp4');
    expect(result.ext).toBe('mp4');
    expect(result.durationSec).toBeGreaterThan(0);
  });

  test('rejects an SVG even when extension says png', async () => {
    await expect(sniffAndValidate(fx('evil.svg'))).rejects.toBeInstanceOf(MediaUnsupportedError);
  });

  test('rejects an HTML payload with .jpg extension', async () => {
    await expect(sniffAndValidate(fx('evil-html-as.jpg'))).rejects.toBeInstanceOf(
      MediaUnsupportedError
    );
  });
});
