import { describe, expect, test } from 'vitest';
import {
  finalDirFromRelative,
  finalRelativePath,
  resolveVariantPath,
  stagingDir,
  variantFilename
} from '@/lib/server/media/paths';

describe('media paths', () => {
  test('stagingDir joins dataDir + _staging + uploadId', () => {
    expect(stagingDir('/tmp/data', 'upl-1')).toBe('/tmp/data/media/_staging/upl-1');
  });

  test('finalRelativePath uses year/month from a unix-ms timestamp', () => {
    expect(finalRelativePath('baby-uuid', Date.UTC(2026, 4, 17), 'media-uuid')).toBe(
      'media/baby-uuid/2026/05/media-uuid'
    );
  });

  test('variantFilename returns ext-aware names', () => {
    expect(variantFilename('original', 'jpg')).toBe('original.jpg');
    expect(variantFilename('large', 'jpg')).toBe('large.webp');
    expect(variantFilename('thumb', 'png')).toBe('thumb.webp');
    expect(variantFilename('poster', 'mp4')).toBe('poster.webp');
  });

  test('resolveVariantPath stitches data dir + relative + variant', () => {
    expect(resolveVariantPath('/tmp/data', 'media/b/2026/05/m', 'large', 'jpg')).toBe(
      '/tmp/data/media/b/2026/05/m/large.webp'
    );
  });

  test('finalDirFromRelative refuses path traversal', () => {
    expect(() => finalDirFromRelative('/tmp/data', 'media/../escape')).toThrow();
  });
});
