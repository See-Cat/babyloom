import { describe, it, expect } from 'vitest';
import { applyUploadedMedia } from './uploaded-media';
import type { UploadedMedia } from '@/components/media/UploadButton';

const queued = (id: string): UploadedMedia => ({ uploadId: id, filename: `${id}.jpg`, status: 'pending', phase: 'queued', type: 'photo' });
const ready = (id: string): UploadedMedia => ({ uploadId: id, mediaId: `m-${id}`, filename: `${id}.jpg`, status: 'ready', type: 'photo' });

describe('applyUploadedMedia', () => {
  it('appends a new pending upload', () => {
    const next = applyUploadedMedia([], queued('u1'));
    expect(next.map((m) => m.uploadId)).toEqual(['u1']);
  });

  it('replaces an existing item in place by uploadId', () => {
    const next = applyUploadedMedia([queued('u1')], ready('u1'));
    expect(next).toHaveLength(1);
    expect(next[0].status).toBe('ready');
  });

  it('ignores a ready callback for an unknown (removed) uploadId — no revival', () => {
    const next = applyUploadedMedia([queued('u1')], ready('u2'));
    expect(next.map((m) => m.uploadId)).toEqual(['u1']);
  });

  it('ignores a failed callback for an unknown (removed) uploadId', () => {
    const failed: UploadedMedia = { uploadId: 'gone', filename: 'x.jpg', status: 'failed', type: 'photo' };
    const next = applyUploadedMedia([queued('u1')], failed);
    expect(next.map((m) => m.uploadId)).toEqual(['u1']);
  });

  it('does not mutate the input array', () => {
    const prev = [queued('u1')];
    applyUploadedMedia(prev, queued('u2'));
    expect(prev).toHaveLength(1);
  });
});
