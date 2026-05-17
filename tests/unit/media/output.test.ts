import { describe, expect, test } from 'vitest';
import { OutputBadRequestError, resolveOutputVariant } from '@/lib/media/output';

const photoRow = {
  id: 'm1',
  type: 'photo' as const,
  mimeType: 'image/jpeg',
  originalExt: 'jpg',
  filename: 'baby<smile>.jpg'
};
const videoRow = {
  id: 'm2',
  type: 'video' as const,
  mimeType: 'video/mp4',
  originalExt: 'mp4',
  filename: 'first-steps.mp4'
};

describe('resolveOutputVariant', () => {
  test('photo + original returns DB mime + attachment disposition', () => {
    const result = resolveOutputVariant(photoRow, 'original');
    expect(result.variantFile).toBe('original.jpg');
    expect(result.contentType).toBe('image/jpeg');
    expect(result.contentDisposition).toMatch(/^attachment; filename\*=UTF-8''/);
  });

  test('photo + large is webp inline', () => {
    const result = resolveOutputVariant(photoRow, 'large');
    expect(result.variantFile).toBe('large.webp');
    expect(result.contentType).toBe('image/webp');
    expect(result.contentDisposition).toMatch(/^inline; filename\*=UTF-8''/);
  });

  test('photo + poster is rejected', () => {
    expect(() => resolveOutputVariant(photoRow, 'poster')).toThrow(OutputBadRequestError);
  });

  test('video + thumb auto-coerces to poster', () => {
    const result = resolveOutputVariant(videoRow, 'thumb');
    expect(result.variantFile).toBe('poster.webp');
    expect(result.contentType).toBe('image/webp');
  });

  test('video + original returns DB mime', () => {
    expect(resolveOutputVariant(videoRow, 'original').contentType).toBe('video/mp4');
  });

  test('illegal size is rejected', () => {
    expect(() => resolveOutputVariant(photoRow, 'gigantic')).toThrow(OutputBadRequestError);
  });

  test('filename strips control chars + RFC 5987 encodes', () => {
    const result = resolveOutputVariant({ ...photoRow, filename: 'a\r\nb"c\u0001.jpg' }, 'large');
    expect(result.contentDisposition).not.toMatch(/[\r\n"]/);
    expect(result.contentDisposition).toMatch(/filename\*=UTF-8''/);
  });
});
