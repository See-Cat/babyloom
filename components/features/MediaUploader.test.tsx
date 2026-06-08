import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { MediaUploader } from './MediaUploader';
import type { UploadedMedia } from '@/components/media/UploadButton';

function render(media: UploadedMedia[]): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <MediaUploader babyId="baby-1" uploadedMedia={media} onUploaded={() => undefined} onRemove={() => undefined} />
    </ToastProvider>
  );
}

function countRemoveButtons(html: string): number {
  return (html.match(/aria-label="移除"/g) || []).length;
}

describe('MediaUploader remove button visibility', () => {
  it('shows a remove button for a queued upload (cancellable)', () => {
    const html = render([{ uploadId: 'u1', filename: 'a.jpg', status: 'pending', phase: 'queued', type: 'photo' }]);
    expect(countRemoveButtons(html)).toBe(1);
  });

  it('hides the remove button while uploading (not cancellable)', () => {
    const html = render([{ uploadId: 'u1', filename: 'a.jpg', status: 'pending', phase: 'uploading', type: 'photo' }]);
    expect(countRemoveButtons(html)).toBe(0);
  });

  it('hides the remove button for a pending item with no phase (server still processing)', () => {
    const html = render([{ uploadId: 'u1', filename: 'a.jpg', status: 'pending', type: 'photo' }]);
    expect(countRemoveButtons(html)).toBe(0);
  });

  it('shows a remove button for a ready media', () => {
    const html = render([{ uploadId: 'u1', mediaId: 'm1', filename: 'a.jpg', status: 'ready', type: 'photo' }]);
    expect(countRemoveButtons(html)).toBe(1);
  });

  it('shows a remove button for a failed upload', () => {
    const html = render([{ uploadId: 'u1', filename: 'a.jpg', status: 'failed', type: 'photo' }]);
    expect(countRemoveButtons(html)).toBe(1);
  });
});
